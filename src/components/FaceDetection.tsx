import { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, CameraOff, Scan } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const FaceDetection = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [faceCount, setFaceCount] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadModels();
    return () => {
      stopCamera();
    };
  }, []);

  const loadModels = async () => {
    try {
      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]);
      setIsModelLoaded(true);
      toast({
        title: "✓ AI Model Loaded",
        description: "Face detection is ready to use",
      });
    } catch (error) {
      console.error('Error loading models:', error);
      toast({
        title: "Model Loading Failed",
        description: "Please refresh the page",
        variant: "destructive",
      });
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraOn(true);
        
        videoRef.current.onloadedmetadata = () => {
          startDetection();
        };
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Camera Access Denied",
        description: "Please allow camera access to use face detection",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
    setIsDetecting(false);
    setFaceCount(0);
  };

  const startDetection = async () => {
    if (!videoRef.current || !canvasRef.current || !isModelLoaded) return;
    
    setIsDetecting(true);
    
    const detectFaces = async () => {
      if (!videoRef.current || !canvasRef.current || !isCameraOn) return;

      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions();

      const canvas = canvasRef.current;
      const displaySize = {
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight,
      };

      faceapi.matchDimensions(canvas, displaySize);
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      
      // Custom drawing with neon effect
      resizedDetections.forEach((detection) => {
        const box = detection.detection.box;
        if (ctx) {
          // Outer glow
          ctx.strokeStyle = 'rgba(34, 211, 238, 0.3)';
          ctx.lineWidth = 8;
          ctx.strokeRect(box.x - 4, box.y - 4, box.width + 8, box.height + 8);
          
          // Main box
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 2;
          ctx.strokeRect(box.x, box.y, box.width, box.height);
          
          // Corner accents
          const cornerSize = 20;
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 3;
          
          // Top-left
          ctx.beginPath();
          ctx.moveTo(box.x, box.y + cornerSize);
          ctx.lineTo(box.x, box.y);
          ctx.lineTo(box.x + cornerSize, box.y);
          ctx.stroke();
          
          // Top-right
          ctx.beginPath();
          ctx.moveTo(box.x + box.width - cornerSize, box.y);
          ctx.lineTo(box.x + box.width, box.y);
          ctx.lineTo(box.x + box.width, box.y + cornerSize);
          ctx.stroke();
          
          // Bottom-left
          ctx.beginPath();
          ctx.moveTo(box.x, box.y + box.height - cornerSize);
          ctx.lineTo(box.x, box.y + box.height);
          ctx.lineTo(box.x + cornerSize, box.y + box.height);
          ctx.stroke();
          
          // Bottom-right
          ctx.beginPath();
          ctx.moveTo(box.x + box.width - cornerSize, box.y + box.height);
          ctx.lineTo(box.x + box.width, box.y + box.height);
          ctx.lineTo(box.x + box.width, box.y + box.height - cornerSize);
          ctx.stroke();
        }
      });

      setFaceCount(detections.length);

      if (isCameraOn) {
        requestAnimationFrame(detectFaces);
      }
    };

    detectFaces();
  };

  const toggleCamera = () => {
    if (isCameraOn) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  return (
    <Card className="relative overflow-hidden bg-gradient-card border-border shadow-card">
      {/* Animated scan line effect */}
      {isDetecting && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan" />
        </div>
      )}
      
      <div className="relative aspect-video bg-background/50 overflow-hidden rounded-lg">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full"
        />
        
        {!isCameraOn && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 backdrop-blur-sm">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                <Camera className="w-10 h-10 text-primary" />
              </div>
              <p className="text-muted-foreground">Camera is off</p>
            </div>
          </div>
        )}
        
        {/* Stats overlay */}
        {isCameraOn && (
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm px-4 py-2 rounded-full border border-primary/50">
              <Scan className="w-4 h-4 text-primary animate-pulse-glow" />
              <span className="text-sm font-medium text-foreground">
                {isDetecting ? 'Detecting...' : 'Ready'}
              </span>
            </div>
            
            <div className="bg-background/80 backdrop-blur-sm px-4 py-2 rounded-full border border-accent/50">
              <span className="text-sm font-medium text-foreground">
                Faces: <span className="text-accent font-bold">{faceCount}</span>
              </span>
            </div>
          </div>
        )}
      </div>
      
      <div className="p-6 flex items-center justify-center gap-4">
        <Button
          onClick={toggleCamera}
          disabled={!isModelLoaded}
          size="lg"
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow transition-all duration-300 hover:scale-105"
        >
          {isCameraOn ? (
            <>
              <CameraOff className="w-5 h-5 mr-2" />
              Stop Camera
            </>
          ) : (
            <>
              <Camera className="w-5 h-5 mr-2" />
              Start Camera
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};

export default FaceDetection;
