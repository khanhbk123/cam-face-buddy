import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';
import FaceDetectionAdvanced from '@/components/FaceDetectionAdvanced';
import { Sparkles, Brain, Shield, LogOut, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import heroBg from '@/assets/hero-bg.jpg';

const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20">
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url(${heroBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background" />
        
        <div className="container relative z-10 mx-auto px-4">
          <div className="flex justify-end mb-4">
            {session ? (
              <Button
                onClick={handleLogout}
                variant="secondary"
                size="sm"
                className="shadow-glow"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            ) : (
              <Button
                onClick={() => navigate('/auth')}
                variant="secondary"
                size="sm"
                className="shadow-glow"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </Button>
            )}
          </div>

          <div className="text-center space-y-6 mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30">
              <Sparkles className="w-4 h-4 text-primary animate-pulse-glow" />
              <span className="text-sm font-medium text-primary">Powered by AI</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Face Recognition
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Advanced AI-powered facial detection and recognition system
              <br />
              Real-time processing with high accuracy
            </p>
          </div>

          {/* Main Feature */}
          <div className="max-w-4xl mx-auto mb-16">
            <FaceDetectionAdvanced />
            
            {!session && (
              <div className="mt-6 text-center bg-background/80 backdrop-blur-sm p-6 rounded-lg border border-border">
                <p className="text-muted-foreground mb-4">
                  Sign in to save faces and enable face comparison features
                </p>
                <Button onClick={() => navigate('/auth')} className="bg-primary hover:bg-primary/90">
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In to Continue
                </Button>
              </div>
            )}
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-gradient-card p-6 rounded-xl border border-border shadow-card hover:shadow-glow transition-all duration-300">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4">
                <Brain className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">AI Detection</h3>
              <p className="text-sm text-muted-foreground">
                Advanced neural networks for accurate face detection and landmark recognition
              </p>
            </div>

            <div className="bg-gradient-card p-6 rounded-xl border border-border shadow-card hover:shadow-glow transition-all duration-300">
              <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Real-time Processing</h3>
              <p className="text-sm text-muted-foreground">
                Instant face detection with smooth performance and low latency
              </p>
            </div>

            <div className="bg-gradient-card p-6 rounded-xl border border-border shadow-card hover:shadow-glow transition-all duration-300">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Privacy First</h3>
              <p className="text-sm text-muted-foreground">
                All processing happens locally in your browser - no data sent to servers
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
