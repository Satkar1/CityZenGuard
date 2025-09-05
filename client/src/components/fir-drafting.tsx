import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import StepIndicator from "@/components/step-indicator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { authService } from "@/lib/auth";
import { LegalSection, FirFormData } from "@/types";

const firSchema = z.object({
  incidentType: z.string().min(1, "Please select an incident type"),
  location: z.string().min(1, "Location is required"),
  incidentDate: z.string().min(1, "Date is required"),
  incidentTime: z.string().min(1, "Time is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  victimName: z.string().min(1, "Victim name is required"),
  victimContact: z.string().min(10, "Valid contact number is required"),
  victimAddress: z.string().min(1, "Address is required"),
  legalSections: z.array(z.string()).default([]),
  additionalComments: z.string().optional(),
});

const steps = [
  "Incident Details",
  "Victim Information", 
  "Legal Sections",
  "Review & Submit"
];

export default function FirDrafting() {
  const [currentStep, setCurrentStep] = useState(1);
  const [suggestedSections, setSuggestedSections] = useState<LegalSection[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<FirFormData>({
    resolver: zodResolver(firSchema),
    defaultValues: {
      incidentType: "",
      location: "",
      incidentDate: "",
      incidentTime: "",
      description: "",
      victimName: "",
      victimContact: "",
      victimAddress: "",
      legalSections: [],
      additionalComments: "",
    },
  });

  const suggestSectionsMutation = useMutation({
    mutationFn: async (data: { description: string; incidentType: string; location: string }) => {
      const response = await apiRequest("POST", "/api/firs/predict-sections", {
        incidentDescription: data.description,
        incidentType: data.incidentType,
        location: data.location,
      });
      return response.json();
    },
    onSuccess: (data) => {
      // Map the response format to expected LegalSection format
      const mappedSections = data.suggestions?.map((suggestion: any) => ({
        section: suggestion.section,
        title: `IPC Section ${suggestion.section}`,
        description: suggestion.description,
      })) || [];
      setSuggestedSections(mappedSections);
    },
    onError: (error) => {
      console.error("Section prediction error:", error);
      toast({
        title: "Failed to suggest sections",
        description: "Using default sections for this incident type",
        variant: "destructive",
      });
    },
  });

  const submitFirMutation = useMutation({
    mutationFn: async (data: FirFormData) => {
      const user = authService.getCurrentUser();
      if (!user) throw new Error("User not authenticated");
      
      const firData = {
        ...data,
        officerId: user.id,
        incidentDate: new Date(data.incidentDate).toISOString(),
      };
      
      const response = await apiRequest("POST", "/api/firs", firData);
      return response.json();
    },
    onSuccess: () => {
      setIsComplete(true);
      queryClient.invalidateQueries({ queryKey: ["/api/firs"] });
      toast({
        title: "FIR submitted successfully",
        description: "Your FIR has been submitted to the system.",
      });
    },
    onError: (error) => {
      console.error("FIR submission error:", error);
      toast({
        title: "Failed to submit FIR",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  const nextStep = async () => {
    if (currentStep === 1) {
      const isValid = await form.trigger(["incidentType", "location", "incidentDate", "incidentTime", "description"]);
      if (isValid) {
        const values = form.getValues();
        suggestSectionsMutation.mutate({
          description: values.description,
          incidentType: values.incidentType,
          location: values.location,
        });
        setCurrentStep(2);
      }
    } else if (currentStep === 2) {
      const isValid = await form.trigger(["victimName", "victimContact", "victimAddress"]);
      if (isValid) {
        setCurrentStep(3);
      }
    } else if (currentStep === 3) {
      setCurrentStep(4);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = (data: FirFormData) => {
    submitFirMutation.mutate(data);
  };

  const toggleSection = (section: string) => {
    const currentSections = form.getValues("legalSections");
    if (currentSections.includes(section)) {
      form.setValue("legalSections", currentSections.filter(s => s !== section));
    } else {
      form.setValue("legalSections", [...currentSections, section]);
    }
  };

  const resetForm = () => {
    form.reset();
    setCurrentStep(1);
    setSuggestedSections([]);
    setIsComplete(false);
  };

  if (isComplete) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <h3 className="text-2xl font-semibold text-legal-blue mb-4">FIR Successfully Drafted!</h3>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Your FIR has been submitted to the system. You can view or print it from the dashboard.
          </p>
          <div className="space-x-4">
            <Button className="bg-legal-blue hover:bg-legal-blue-light">
              View FIR
            </Button>
            <Button variant="outline" onClick={resetForm}>
              Draft Another FIR
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center mb-8">
          <svg className="w-6 h-6 text-legal-blue mr-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z"/>
          </svg>
          <h3 className="text-2xl font-semibold text-legal-blue">FIR Drafting Assistant</h3>
        </div>

        <StepIndicator currentStep={currentStep} steps={steps} />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {/* Step 1: Incident Details */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <h4 className="text-lg font-semibold text-legal-blue mb-6">Step 1: Incident Details</h4>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="incidentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Incident Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select incident type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="theft">Theft</SelectItem>
                            <SelectItem value="assault">Assault</SelectItem>
                            <SelectItem value="fraud">Fraud</SelectItem>
                            <SelectItem value="cybercrime">Cybercrime</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter incident location" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="incidentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="incidentTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Incident Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          rows={4} 
                          placeholder="Describe the incident in detail..." 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-sm text-gray-500 mt-2">
                        AI will analyze this description to suggest relevant IPC sections
                      </p>
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Step 2: Victim Information */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <h4 className="text-lg font-semibold text-legal-blue mb-6">Step 2: Victim Information</h4>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="victimName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Victim Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter victim's full name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="victimContact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Number</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="Enter contact number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="victimAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea 
                          rows={3} 
                          placeholder="Enter victim's address" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Step 3: Legal Sections */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <h4 className="text-lg font-semibold text-legal-blue mb-6">Step 3: AI-Suggested Legal Sections</h4>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-800">
                    <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                    </svg>
                    Based on the incident description, our AI system recommends the following applicable legal sections:
                  </p>
                </div>

                {suggestSectionsMutation.isPending && (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-legal-blue border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-600">Analyzing incident and suggesting legal sections...</p>
                  </div>
                )}

                {suggestedSections.length > 0 && (
                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    {suggestedSections.map((section, index) => (
                      <div
                        key={index}
                        onClick={() => toggleSection(section.section)}
                        className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                          form.getValues("legalSections").includes(section.section)
                            ? 'border-legal-blue bg-legal-blue-lighter'
                            : 'border-gray-200 hover:border-legal-blue'
                        }`}
                      >
                        <h5 className="font-semibold text-legal-blue mb-2">{section.section}</h5>
                        <p className="text-sm text-gray-600 mb-2">{section.title}</p>
                        <p className="text-xs text-gray-500">{section.description}</p>
                      </div>
                    ))}
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="additionalComments"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Comments</FormLabel>
                      <FormControl>
                        <Textarea 
                          rows={3} 
                          placeholder="Any additional legal considerations or comments..." 
                          {...field} 
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Step 4: Review & Submit */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <h4 className="text-lg font-semibold text-legal-blue mb-6">Step 4: Review & Submit</h4>
                
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h5 className="font-semibold text-gray-900 mb-3">Incident Details</h5>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div><strong>Type:</strong> {form.getValues("incidentType")}</div>
                      <div><strong>Date:</strong> {form.getValues("incidentDate")}</div>
                      <div><strong>Time:</strong> {form.getValues("incidentTime")}</div>
                      <div><strong>Location:</strong> {form.getValues("location")}</div>
                    </div>
                    <div className="mt-3">
                      <strong>Description:</strong>
                      <p className="text-sm text-gray-600 mt-1">{form.getValues("description")}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h5 className="font-semibold text-gray-900 mb-3">Victim Information</h5>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div><strong>Name:</strong> {form.getValues("victimName")}</div>
                      <div><strong>Contact:</strong> {form.getValues("victimContact")}</div>
                    </div>
                    <div className="mt-3">
                      <strong>Address:</strong>
                      <p className="text-sm text-gray-600 mt-1">{form.getValues("victimAddress")}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h5 className="font-semibold text-gray-900 mb-3">Applied Legal Sections</h5>
                    <div className="space-y-2">
                      {form.getValues("legalSections").map((section, index) => (
                        <div key={index} className="flex items-center text-sm">
                          <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                          </svg>
                          <span>{section}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
              >
                Previous
              </Button>
              
              {currentStep < 4 ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  className="bg-legal-blue hover:bg-legal-blue-light"
                >
                  {currentStep === 3 ? "Review FIR" : `Next: ${steps[currentStep]}`}
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700"
                  disabled={submitFirMutation.isPending}
                >
                  {submitFirMutation.isPending ? "Submitting..." : "Submit FIR"}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
