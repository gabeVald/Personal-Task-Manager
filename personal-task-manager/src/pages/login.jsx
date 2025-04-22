import { GalleryVerticalEnd } from "lucide-react";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
    return (
        <div className="grid min-h-screen lg:grid-cols-2">
            <div className="flex flex-col gap-4 p-6 md:p-10">
                <div className="flex justify-center gap-2 md:justify-start">
                    <Link
                        href="/"
                        className="flex items-center gap-2 font-medium"
                    >
                        <div className="bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-md">
                            <GalleryVerticalEnd className="size-4" />
                        </div>
                        Personal Task Manager
                    </Link>
                </div>
                <div className="flex flex-1 items-center justify-center">
                    <div className="w-full max-w-xs">
                        <LoginForm />
                    </div>
                </div>
            </div>
            <div className="bg-neutral-100 relative hidden lg:block">
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center p-8">
                        <h2 className="text-2xl font-bold mb-4">
                            Manage Your Tasks Efficiently
                        </h2>
                        <p className="mb-8">
                            Keep track of your daily tasks, todos, and important
                            items in one place.
                        </p>
                        <Link href="/">
                            <Button>GitHub Repo</Button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
