import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Header from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["citizen", "police"], {
    required_error: "Please select a role",
  }),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      role: "citizen",
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const response = await authService.login(data.email, data.password);
      
      toast({
        title: "Login successful",
        description: "Welcome back!",
      });

      // Use actual user role from API response, not form selection
      if (response.user.role === "citizen") {
        setLocation("/citizen-dashboard");
      } else if (response.user.role === "police") {
        setLocation("/police-dashboard");
      } else {
        setLocation("/citizen-dashboard"); // Default fallback
      }
    } catch (error) {
      toast({
        title: "Login failed",
        description: "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-md mx-auto">
          <Card className="shadow-xl">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <svg className="w-12 h-12 text-legal-blue mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2z"/>
                </svg>
                <h2 className="text-2xl font-semibold text-legal-blue">Login to Your Account</h2>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="Enter your email"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder="Enter your password"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Your Role</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex space-x-4"
                          >
                            <div className="flex-1">
                              <Label 
                                htmlFor="citizen" 
                                className="border-2 border-gray-300 rounded-lg p-4 text-center hover:border-legal-blue transition-colors cursor-pointer block"
                              >
                                <RadioGroupItem value="citizen" id="citizen" className="sr-only" />
                                <svg className="w-8 h-8 text-legal-blue mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2z"/>
                                </svg>
                                <div className="font-medium">Citizen</div>
                              </Label>
                            </div>
                            <div className="flex-1">
                              <Label 
                                htmlFor="police" 
                                className="border-2 border-gray-300 rounded-lg p-4 text-center hover:border-legal-blue transition-colors cursor-pointer block"
                              >
                                <RadioGroupItem value="police" id="police" className="sr-only" />
                                <svg className="w-8 h-8 text-legal-blue mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,6A1,1 0 0,1 13,7V8A1,1 0 0,1 12,9A1,1 0 0,1 11,8V7A1,1 0 0,1 12,6M11,11H13V17H11V11Z"/>
                                </svg>
                                <div className="font-medium">Police Officer</div>
                              </Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full bg-legal-blue hover:bg-legal-blue-light"
                    disabled={loading}
                  >
                    {loading ? "Logging in..." : "Login"}
                  </Button>
                </form>
              </Form>

              <div className="text-center mt-6">
                <p className="text-gray-600">
                  Don't have an account? 
                  <Link href="/register" className="text-legal-blue hover:underline font-medium ml-1">Register here</Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
