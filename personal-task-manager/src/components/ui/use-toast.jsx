import * as React from "react";
import { createContext, useContext, useState } from "react";

import { cn } from "@/lib/utils";

const ToastViewport = React.forwardRef(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
            className
        )}
        {...props}
    />
));
ToastViewport.displayName = "ToastViewport";

const Toast = React.forwardRef(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-4 pr-6 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
            "border bg-background text-foreground",
            className
        )}
        {...props}
    />
));
Toast.displayName = "Toast";

const ToastAction = React.forwardRef(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
            className
        )}
        {...props}
    />
));
ToastAction.displayName = "ToastAction";

const ToastClose = React.forwardRef(({ className, ...props }, ref) => (
    <button
        ref={ref}
        className={cn(
            "absolute top-2 right-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100",
            className
        )}
        {...props}
    >
        ✕
    </button>
));
ToastClose.displayName = "ToastClose";

const ToastTitle = React.forwardRef(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("text-sm font-semibold", className)}
        {...props}
    />
));
ToastTitle.displayName = "ToastTitle";

const ToastDescription = React.forwardRef(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm opacity-90", className)} {...props} />
));
ToastDescription.displayName = "ToastDescription";

const ToastContext = createContext({});

function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    return (
        <ToastContext.Provider
            value={{
                toasts,
                addToast: (toast) => {
                    const id = Math.random().toString(36).substring(2, 9);
                    setToasts((prev) => [...prev, { ...toast, id }]);

                    // Auto remove toast after duration
                    setTimeout(() => {
                        setToasts((prev) => prev.filter((t) => t.id !== id));
                    }, toast.duration || 3000);
                },
                removeToast: (id) => {
                    setToasts((prev) =>
                        prev.filter((toast) => toast.id !== id)
                    );
                },
            }}
        >
            {children}

            <ToastViewport>
                {toasts.map((toast) => (
                    <Toast key={toast.id} className="mb-2">
                        {toast.title && <ToastTitle>{toast.title}</ToastTitle>}
                        {toast.description && (
                            <ToastDescription>
                                {toast.description}
                            </ToastDescription>
                        )}
                        <ToastClose
                            onClick={() => {
                                setToasts((prev) =>
                                    prev.filter((t) => t.id !== toast.id)
                                );
                            }}
                        />
                    </Toast>
                ))}
            </ToastViewport>
        </ToastContext.Provider>
    );
}

function useToast() {
    const context = useContext(ToastContext);

    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }

    return context;
}

export {
    ToastProvider,
    ToastTitle,
    ToastDescription,
    ToastClose,
    ToastAction,
    useToast,
};
