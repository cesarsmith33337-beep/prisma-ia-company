import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, base64ToFloat32, blobToBase64 } from '../utils/audioUtils';

export const useLiveSession = (videoRef: React.RefObject<HTMLVideoElement>) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const videoIntervalRef = useRef<number | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Track active session and connection intent
  const activeSessionPromiseRef = useRef<Promise<any> | null>(null);
  const isIntentionalStopRef = useRef(false);
  const retryTimeoutRef = useRef<number | null>(null);

  // Helper to cleanup current session resources
  const cleanupResources = useCallback(async () => {
    // Stop video loop
    if (videoIntervalRef.current) {
        clearInterval(videoIntervalRef.current);
        videoIntervalRef.current = null;
    }
    
    // Close Audio Inputs
    if (processorRef.current) {
        try { processorRef.current.disconnect(); } catch(e){}
        processorRef.current = null;
    }
    if (sourceRef.current) {
        try { sourceRef.current.disconnect(); } catch(e){}
        sourceRef.current = null;
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
    
    // Close Session
    if (activeSessionPromiseRef.current) {
        try {
            const session = await activeSessionPromiseRef.current;
            session.close();
        } catch (e) { 
            // Ignore errors on close
        }
        activeSessionPromiseRef.current = null;
    }

    // Close Contexts
    if (inputAudioContextRef.current) {
        try { await inputAudioContextRef.current.close(); } catch(e){}
        inputAudioContextRef.current = null;
    }
    if (audioContextRef.current) {
        try { await audioContextRef.current.close(); } catch(e){}
        audioContextRef.current = null;
    }

    setIsConnected(false);
    setIsSpeaking(false);
  }, []);

  const connect = useCallback(async (retryCount = 0) => {
    if (!process.env.API_KEY) {
      console.error("API Key not found");
      return;
    }

    // Mark that we intend to be connected
    isIntentionalStopRef.current = false;

    // Clean up any previous attempts before starting new one
    if (retryCount > 0) {
        await cleanupResources();
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Initialize Audio Contexts
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputAudioContextRef.current = inputCtx;
      
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      // Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000
        } 
      });
      streamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "Você é o Prisma, uma IA de elite em Análise Técnica. Você está observando um gráfico de trading ao vivo. Sua estratégia principal é '4 VELAS + BOLLINGER': Se vir 4 velas consecutivas da mesma cor e a 4ª romper a média central, é sinal de entrada na 5ª. CALL se forem 4 verdes rompendo pra cima. PUT se forem 4 vermelhas rompendo pra baixo. Identifique também níveis de SUPORTE e RESISTÊNCIA. Seja extremamente conciso. Fale sempre em Português do Brasil.",
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Connected");
            setIsConnected(true);
            
            // Setup Input Audio Stream
            const source = inputCtx.createMediaStreamSource(stream);
            sourceRef.current = source;
            
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              if (isIntentionalStopRef.current) return;

              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              
              sessionPromise.then(session => {
                  try {
                      session.sendRealtimeInput({ media: pcmBlob });
                  } catch (err) {
                      // Silent catch for send errors during disconnects
                  }
              }).catch(() => {});
              
              // Volume calc
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              setAudioVolume(Math.sqrt(sum/inputData.length));
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);

            // Start Video Loop
            startVideoStream(sessionPromise);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (isIntentionalStopRef.current) return;

            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && outputCtx) {
              setIsSpeaking(true);
              try {
                const float32Data = base64ToFloat32(audioData);
                const buffer = outputCtx.createBuffer(1, float32Data.length, 24000);
                buffer.getChannelData(0).set(float32Data);

                const source = outputCtx.createBufferSource();
                source.buffer = buffer;
                source.connect(outputCtx.destination);

                const currentTime = outputCtx.currentTime;
                const startTime = Math.max(currentTime, nextStartTimeRef.current);
                source.start(startTime);
                nextStartTimeRef.current = startTime + buffer.duration;
                
                source.onended = () => {
                    if (outputCtx && outputCtx.currentTime >= nextStartTimeRef.current - 0.1) {
                        setIsSpeaking(false);
                    }
                }
              } catch (decodeErr) {
                console.error("Audio decode error:", decodeErr);
              }
            }
          },
          onclose: () => {
            console.log("Gemini Live Disconnected");
            setIsConnected(false);
          },
          onerror: (err) => {
            console.error("Gemini Live Error", err);
            setIsConnected(false);
            
            // Retry Logic for Runtime Errors
            if (!isIntentionalStopRef.current && retryCount < 5) {
                const delay = Math.pow(2, retryCount) * 1000;
                console.log(`Reconnecting (Runtime Error) in ${delay}ms...`);
                retryTimeoutRef.current = window.setTimeout(() => {
                    connect(retryCount + 1);
                }, delay);
            }
          }
        }
      });
      
      activeSessionPromiseRef.current = sessionPromise;

      // CRITICAL FIX: Handle connection handshake errors (like 503 Unavailable)
      sessionPromise.catch((err) => {
           console.error("Gemini Live Connection Handshake Failed", err);
           setIsConnected(false);
           if (!isIntentionalStopRef.current && retryCount < 5) {
                const delay = Math.pow(2, retryCount) * 1000;
                console.log(`Reconnecting (Handshake Error) in ${delay}ms...`);
                retryTimeoutRef.current = window.setTimeout(() => {
                    connect(retryCount + 1);
                }, delay);
           }
      });

    } catch (err) {
      console.error("Connection setup failed", err);
      setIsConnected(false);
      
      // Retry Logic for Setup Failures
      if (!isIntentionalStopRef.current && retryCount < 5) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`Retry connection attempt ${retryCount + 1} in ${delay}ms...`);
        retryTimeoutRef.current = window.setTimeout(() => {
            connect(retryCount + 1);
        }, delay);
      }
    }
  }, [cleanupResources]);

  const startVideoStream = (sessionPromise: Promise<any>) => {
    if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);

    videoIntervalRef.current = window.setInterval(() => {
        if (!videoRef.current || videoRef.current.readyState !== 4) return;
        if (isIntentionalStopRef.current) return;
        
        const canvas = document.createElement('canvas');
        const scale = 0.5; 
        canvas.width = videoRef.current.videoWidth * scale;
        canvas.height = videoRef.current.videoHeight * scale;
        
        const ctx = canvas.getContext('2d');
        if(!ctx) return;
        
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
            if (blob) {
                try {
                    const base64Data = await blobToBase64(blob);
                    sessionPromise.then(session => {
                        try {
                           session.sendRealtimeInput({
                                media: {
                                    mimeType: 'image/jpeg',
                                    data: base64Data
                                }
                           });
                        } catch (e) {
                           // Silent catch
                        }
                    }).catch(() => {});
                } catch(e) {
                    console.error("Video processing error", e);
                }
            }
        }, 'image/jpeg', 0.5); 
    }, 2000); 
  };

  const disconnect = useCallback(() => {
    isIntentionalStopRef.current = true;
    if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
    }
    cleanupResources();
  }, [cleanupResources]);

  // Cleanup on unmount
  useEffect(() => {
      return () => {
          disconnect();
      }
  }, [disconnect]);

  return {
    connect: () => connect(0), // Reset retries on manual connect
    disconnect,
    isConnected,
    isSpeaking,
    audioVolume
  };
};