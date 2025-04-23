import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/router";

// Login form schema (username + password only)
const loginFormSchema = z.object({
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required"),
});

// Separate schema for account creation (includes email)
const createAccountSchema = z.object({
    username: z.string().min(1, "Username is required"),
    email: z.string().email("Valid email is required"),
    password: z.string().min(5, "Password must be at least 6 characters"),
});

export function LoginForm({ className, ...props }) {
    const [isLoading, setIsLoading] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    // Initialize the login form
    const form = useForm({
        resolver: zodResolver(loginFormSchema),
        defaultValues: {
            username: "",
            password: "",
        },
    });

    // Initialize the signup form
    const signupForm = useForm({
        resolver: zodResolver(createAccountSchema),
        defaultValues: {
            username: "",
            email: "",
            password: "",
        },
    });

    // Define submission handler for login
    const handleSubmit = async (values) => {
        setIsLoading(true);
        try {
            // Convert the form data to x-www-form-urlencoded format for OAuth2 requirements
            const formData = new URLSearchParams();
            formData.append("username", values.username);
            formData.append("password", values.password);

            const response = await fetch("http://localhost:8000/users/sign-in", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Login failed");
            }

            const data = await response.json();

            // Store the token in localStorage
            localStorage.setItem("token", data.access_token);

            toast({
                title: "Login successful",
                description: "You have been logged in successfully",
            });

            // Redirect to the dashboard
            router.push("/dashboard");
        } catch (error) {
            console.error("Login failed:", error);
            toast({
                title: "Login failed",
                description: error.message || "Please check your credentials and try again",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Define submission handler for account creation
    const handleSignupSubmit = async (values) => {
        setIsLoading(true);
        try {
            const response = await fetch("http://localhost:8000/users/signup", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: values.username,
                    email: values.email,
                    password: values.password,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Account creation failed");
            }

            const data = await response.json();

            toast({
                title: "Account created",
                description: "Your account has been created successfully. You can now log in.",
            });

            setDialogOpen(false);
            signupForm.reset();
        } catch (error) {
            console.error("Signup failed:", error);
            toast({
                title: "Signup failed",
                description: error.message || "Please try again with different credentials",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full">
            <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-bold">Login</CardTitle>
                <CardDescription>Enter your username to login to your account</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className={cn("grid gap-4", className)}>
                        <FormField
                            control={form.control}
                            name="username"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Username</FormLabel>
                                    <FormControl>
                                        <Input type="text" placeholder="" {...field} disabled={isLoading} />
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
                                        <Input type="password" {...field} disabled={isLoading} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? "Logging in..." : "Login"}
                        </Button>
                    </form>
                </Form>

                <div className="relative mt-4">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t"></span>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">Don't have an account?</span>
                    </div>
                </div>
                <div className="mt-4 grid gap-2">
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="w-full">
                                Create Account
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Create a new account</DialogTitle>
                                <DialogDescription>Fill in your details to create an account</DialogDescription>
                            </DialogHeader>
                            <Form {...signupForm}>
                                <form onSubmit={signupForm.handleSubmit(handleSignupSubmit)} className="space-y-4 py-4">
                                    <FormField
                                        control={signupForm.control}
                                        name="username"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Username</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="johndoe" {...field} disabled={isLoading} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={signupForm.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Email</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="example@email.com" type="email" {...field} disabled={isLoading} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={signupForm.control}
                                        name="password"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Password</FormLabel>
                                                <FormControl>
                                                    <Input type="password" {...field} disabled={isLoading} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button type="submit" className="w-full" disabled={isLoading}>
                                        {isLoading ? "Creating..." : "Create Account"}
                                    </Button>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardContent>
        </Card>
    );
}
