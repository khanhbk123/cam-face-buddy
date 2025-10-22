-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create faces table to store face data
CREATE TABLE public.faces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  descriptor JSONB NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.faces ENABLE ROW LEVEL SECURITY;

-- Create policies for face data access
CREATE POLICY "Users can view their own faces"
  ON public.faces
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own faces"
  ON public.faces
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own faces"
  ON public.faces
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own faces"
  ON public.faces
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_faces_updated_at
  BEFORE UPDATE ON public.faces
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_faces_user_id ON public.faces(user_id);
CREATE INDEX idx_faces_created_at ON public.faces(created_at DESC);