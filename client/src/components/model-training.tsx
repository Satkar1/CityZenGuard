import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ModelStats {
  isLoaded: boolean;
  qaPairCount: number;
  categories: string[];
  metadata?: {
    training_date: string;
    num_qa_pairs: number;
    num_categories: number;
    feature_count: number;
    model_version: string;
  };
  confidenceThreshold: number;
}

export default function ModelTraining() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const { toast } = useToast();

  const { data: modelStats, refetch: refetchStats } = useQuery<ModelStats>({
    queryKey: ["/api/ml/stats"],
    queryFn: async () => {
      const response = await fetch("/api/ml/stats", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch model stats");
      return response.json();
    },
  });

  const trainModelMutation = useMutation({
    mutationFn: async (csvPath: string) => {
      const response = await apiRequest("POST", "/api/ml/train", { csvPath });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Model training completed!",
        description: "The AI legal assistant has been updated with new training data.",
      });
      refetchStats();
      setTrainingProgress(100);
    },
    onError: (error: Error) => {
      toast({
        title: "Training failed",
        description: error.message,
        variant: "destructive",
      });
      setTrainingProgress(0);
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "text/csv") {
      setCsvFile(file);
    } else {
      toast({
        title: "Invalid file",
        description: "Please select a CSV file",
        variant: "destructive",
      });
    }
  };

  const handleTrainModel = async () => {
    if (!csvFile) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file first",
        variant: "destructive",
      });
      return;
    }

    // Simulate progress during training
    setTrainingProgress(10);
    
    // For now, use a hardcoded path. In production, you'd upload the file first
    const csvPath = "/attached_assets/enhanced_labeled.csv";
    
    setTrainingProgress(30);
    trainModelMutation.mutate(csvPath);
    
    // Simulate training progress
    const progressInterval = setInterval(() => {
      setTrainingProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <svg className="w-5 h-5 mr-2 text-legal-blue" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L15.09 8.26L22 9L16 14.74L17.18 21.02L12 18.77L6.82 21.02L8 14.74L2 9L8.91 8.26L12 2Z"/>
            </svg>
            ML Model Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Model Status</span>
                <Badge variant={modelStats?.isLoaded ? "default" : "secondary"}>
                  {modelStats?.isLoaded ? "Loaded" : "Not Loaded"}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Training Data</span>
                <span className="text-sm text-gray-600">
                  {modelStats?.qaPairCount || 0} Q&A pairs
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Categories</span>
                <span className="text-sm text-gray-600">
                  {modelStats?.categories?.length || 0} categories
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Confidence Threshold</span>
                <span className="text-sm text-gray-600">
                  {modelStats?.confidenceThreshold ? `${(modelStats.confidenceThreshold * 100).toFixed(0)}%` : "N/A"}
                </span>
              </div>
            </div>
            
            <div className="space-y-3">
              {modelStats?.metadata && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Last Training</span>
                    <span className="text-sm text-gray-600">
                      {new Date(modelStats.metadata.training_date).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Model Version</span>
                    <span className="text-sm text-gray-600">
                      {modelStats.metadata.model_version}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Features</span>
                    <span className="text-sm text-gray-600">
                      {modelStats.metadata.feature_count}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
          
          {modelStats?.categories && modelStats.categories.length > 0 && (
            <div className="mt-4">
              <Label className="text-sm font-medium mb-2 block">Available Categories</Label>
              <div className="flex flex-wrap gap-2">
                {modelStats.categories.map((category, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {category}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Train New Model</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="csv-file">Upload Training Data (CSV)</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="mt-1"
              />
              <p className="text-sm text-gray-500 mt-1">
                CSV should contain columns: question, answer, category
              </p>
            </div>
            
            {csvFile && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-800">
                  ✓ File selected: {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
                </p>
              </div>
            )}
            
            {trainingProgress > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Training Progress</span>
                  <span className="text-sm text-gray-600">{trainingProgress}%</span>
                </div>
                <Progress value={trainingProgress} className="w-full" />
              </div>
            )}
            
            <Button 
              onClick={handleTrainModel}
              disabled={!csvFile || trainModelMutation.isPending}
              className="w-full"
            >
              {trainModelMutation.isPending ? "Training Model..." : "Start Training"}
            </Button>
            
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Model training may take several minutes depending on data size. 
                The system will use your trained model as the primary response system and fall back 
                to Gemini AI for questions not covered in the training data.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}