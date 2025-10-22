import { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Camera, CameraOff, Scan, Save, User, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

interface SavedFace {
  id: string;
  name: string;
  descriptor: number[];
  created_at: string;
}

const FaceDetectionAdvanced = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [faceCount, setFaceCount] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<string>('');
  const [matchedFace, setMatchedFace] = useState<string>('');
  const [savedFaces, setSavedFaces] = useState<SavedFace[]>([]);
  const [faceName, setFaceName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const currentDescriptorRef = useRef<Float32Array | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    loadModels();
    
    return () => {
      subscription.unsubscribe();
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (session) {
      loadSavedFaces();
    }
  }, [session]);

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
        description: "Face detection ready with emotion & recognition",
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

  const loadSavedFaces = async () => {
    if (!session) return;

    const { data, error } = await supabase
      .from('faces')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading faces:', error);
      return;
    }

    if (data) {
      setSavedFaces(data.map(face => ({
        ...face,
        descriptor: face.descriptor as number[],
      })));
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
        description: "Please allow camera access",
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
    setCurrentEmotion('');
    setMatchedFace('');
  };

  const startDetection = async () => {
    if (!videoRef.current || !canvasRef.current || !isModelLoaded) return;
    
    setIsDetecting(true);
    
    const detectFaces = async () => {
      if (!videoRef.current || !canvasRef.current || !isCameraOn) return;

      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions()
        .withFaceDescriptors();

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
      
      // Process emotions and face matching
      if (resizedDetections.length > 0) {
        const detection = resizedDetections[0];
        
        // Get dominant emotion
        const expressions = detection.expressions;
        const maxExpression = Object.entries(expressions).reduce((a, b) => 
          expressions[a[0] as keyof typeof expressions] > expressions[b[0] as keyof typeof expressions] ? a : b
        );
        setCurrentEmotion(maxExpression[0]);

        // Store descriptor for saving
        currentDescriptorRef.current = detection.descriptor;

        // Match with saved faces
        if (savedFaces.length > 0 && session) {
          const faceMatcher = new faceapi.FaceMatcher(
            savedFaces.map(face => 
              new faceapi.LabeledFaceDescriptors(
                face.name,
                [new Float32Array(face.descriptor)]
              )
            ),
            0.6
          );

          const match = faceMatcher.findBestMatch(detection.descriptor);
          setMatchedFace(match.label !== 'unknown' ? match.label : '');
        }
      } else {
        setCurrentEmotion('');
        setMatchedFace('');
        currentDescriptorRef.current = null;
      }

      // Draw detection boxes
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

  const handleSaveFace = async () => {
    if (!session) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to save faces",
        variant: "destructive",
      });
      return;
    }

    if (!currentDescriptorRef.current) {
      toast({
        title: "No Face Detected",
        description: "Please position your face in front of the camera",
        variant: "destructive",
      });
      return;
    }

    if (!faceName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for this face",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from('faces')
      .insert({
        user_id: session.user.id,
        name: faceName,
        descriptor: Array.from(currentDescriptorRef.current),
      });

    if (error) {
      console.error('Error saving face:', error);
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "✓ Face Saved",
      description: `${faceName} has been saved successfully`,
    });

    setFaceName('');
    setShowSaveInput(false);
    loadSavedFaces();
  };

  const handleDeleteFace = async (id: string) => {
    const { error } = await supabase
      .from('faces')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting face:', error);
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "✓ Face Deleted",
      description: "Face removed successfully",
    });

    loadSavedFaces();
  };

  const toggleCamera = () => {
    if (isCameraOn) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden bg-gradient-card border-border shadow-card">
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
          
          {isCameraOn && (
            <div className="absolute top-4 left-4 right-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
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

              {currentEmotion && (
                <div className="bg-background/80 backdrop-blur-sm px-4 py-2 rounded-full border border-primary/50 w-fit">
                  <span className="text-sm font-medium text-foreground">
                    Emotion: <span className="text-primary font-bold capitalize">{currentEmotion}</span>
                  </span>
                </div>
              )}

              {matchedFace && (
                <div className="bg-background/80 backdrop-blur-sm px-4 py-2 rounded-full border border-accent/50 w-fit">
                  <span className="text-sm font-medium text-foreground">
                    Match: <span className="text-accent font-bold">{matchedFace}</span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="p-6 flex flex-col items-center gap-4">
          <div className="flex items-center gap-4">
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

            {isCameraOn && session && (
              <Button
                onClick={() => setShowSaveInput(!showSaveInput)}
                disabled={!currentDescriptorRef.current}
                size="lg"
                variant="secondary"
                className="shadow-glow transition-all duration-300 hover:scale-105"
              >
                <Save className="w-5 h-5 mr-2" />
                Save Face
              </Button>
            )}
          </div>

          {showSaveInput && (
            <div className="flex gap-2 w-full max-w-md">
              <Input
                value={faceName}
                onChange={(e) => setFaceName(e.target.value)}
                placeholder="Enter name for this face"
                className="bg-background border-border"
              />
              <Button onClick={handleSaveFace} className="bg-accent hover:bg-accent/90">
                Save
              </Button>
            </div>
          )}
        </div>
      </Card>

      {session && savedFaces.length > 0 && (
        <Card className="bg-gradient-card border-border shadow-card p-6">
          <h3 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Saved Faces ({savedFaces.length})
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {savedFaces.map((face) => (
              <div
                key={face.id}
                className="bg-background/50 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-foreground truncate">{face.name}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteFace(face.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(face.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default FaceDetectionAdvanced;
