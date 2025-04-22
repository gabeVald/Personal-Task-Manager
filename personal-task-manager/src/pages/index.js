import Image from "next/image";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { TodoTable } from "@/components/Todo";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { useRouter } from "next/router";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { ToastProvider } from "@/components/ui/toast";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export default function Home() {
    const [allTasks, setAllTasks] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [todos, setTodos] = useState([]);
    const [gottados, setGottados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const router = useRouter();

    // Function to fetch all tasks data
    const fetchTasks = async () => {
        try {
            setLoading(true);
            setError(null);

            const token = localStorage.getItem("token");
            const headers = {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            };

            // All tasks
            const allResponse = await fetch("http://127.0.0.1:8000/todos/all", {
                headers,
            });

            if (!allResponse.ok) {
                // If unauthorized, redirect to login
                if (allResponse.status === 401) {
                    localStorage.removeItem("token");
                    router.push("/login");
                    return;
                }
                throw new Error(
                    `Error fetching tasks: ${allResponse.statusText}`
                );
            }

            const allData = await allResponse.json();
            setAllTasks(allData);

            // Tasks
            const tasksResponse = await fetch(
                "http://127.0.0.1:8000/todos/tasks",
                { headers }
            );
            const tasksData = await tasksResponse.json();
            setTasks(tasksData);

            // Todos
            const todosResponse = await fetch(
                "http://127.0.0.1:8000/todos/todos",
                { headers }
            );
            const todosData = await todosResponse.json();
            setTodos(todosData);

            // Gottados
            const gottadosResponse = await fetch(
                "http://127.0.0.1:8000/todos/gottados",
                { headers }
            );
            const gottadosData = await gottadosResponse.json();
            setGottados(gottadosData);
        } catch (error) {
            console.error("Error fetching tasks:", error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Check if user is authenticated
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/login");
            return;
        }

        fetchTasks();
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem("token");
        router.push("/login");
    };

    // Add this function to handle moving tasks
    const handleMoveItem = (index, direction) => {
        if (direction === "up" && index > 0) {
            const newTasks = [...tasks];
            [newTasks[index], newTasks[index - 1]] = [
                newTasks[index - 1],
                newTasks[index],
            ];
            setTasks(newTasks);
        } else if (direction === "down" && index < tasks.length - 1) {
            const newTasks = [...tasks];
            [newTasks[index], newTasks[index + 1]] = [
                newTasks[index + 1],
                newTasks[index],
            ];
            setTasks(newTasks);
        }
    };

    return (
        <div
            className={`min-h-screen flex flex-col ${geistSans.variable} font-sans`}
        >
            <Tabs defaultValue="All" className="flex-1 flex flex-col">
                {/* Top nav/header */}
                <header className="w-full p-4 bg-neutral-100 border-b flex justify-between items-center">
                    <TabsList className="flex justify-between items-center w-full">
                        <TabsTrigger value="All">All</TabsTrigger>
                        <TabsTrigger value="Todays">Todays</TabsTrigger>
                        <TabsTrigger value="Todos">Todos</TabsTrigger>
                        <TabsTrigger value="Gottados">Gottados</TabsTrigger>
                    </TabsList>
                </header>

                {/* Tab content wrapper with z-index control */}
                <div className="relative z-0 flex-1">
                    <TabsContent value="All" className="flex-1 p-4">
                        {loading ? (
                            <div className="h-[200px] flex items-center justify-center text-gray-500">
                                Loading tasks...
                            </div>
                        ) : error ? (
                            <div className="h-[200px] flex items-center justify-center text-red-500">
                                {error}
                            </div>
                        ) : (
                            <div className="flex flex-col space-y-8">
                                <div>
                                    <h2 className="text-2xl font-semibold mb-4">
                                        Tasks
                                    </h2>
                                    <div className="overflow-x-auto rounded-lg border">
                                        <TodoTable
                                            tasks={tasks}
                                            onTaskUpdate={fetchTasks}
                                            onMoveItem={handleMoveItem}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <h2 className="text-2xl font-semibold mb-4">
                                        Todos
                                    </h2>
                                    <div className="overflow-x-auto rounded-lg border">
                                        <TodoTable
                                            tasks={todos}
                                            onTaskUpdate={fetchTasks}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <h2 className="text-2xl font-semibold mb-4">
                                        Gottados
                                    </h2>
                                    <div className="overflow-x-auto rounded-lg border">
                                        <TodoTable
                                            tasks={gottados}
                                            onTaskUpdate={fetchTasks}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="Todays" className="flex-1 p-4">
                        {loading ? (
                            <div className="h-[200px] flex items-center justify-center text-gray-500">
                                Loading tasks...
                            </div>
                        ) : error ? (
                            <div className="h-[200px] flex items-center justify-center text-red-500">
                                {error}
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border">
                                <TodoTable
                                    tasks={tasks}
                                    onTaskUpdate={fetchTasks}
                                />
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="Todos" className="flex-1 p-4">
                        {loading ? (
                            <div className="h-[200px] flex items-center justify-center text-gray-500">
                                Loading todos...
                            </div>
                        ) : error ? (
                            <div className="h-[200px] flex items-center justify-center text-red-500">
                                {error}
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border">
                                <TodoTable
                                    tasks={todos}
                                    onTaskUpdate={fetchTasks}
                                />
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="Gottados" className="flex-1 p-4">
                        {loading ? (
                            <div className="h-[200px] flex items-center justify-center text-gray-500">
                                Loading gottados...
                            </div>
                        ) : error ? (
                            <div className="h-[200px] flex items-center justify-center text-red-500">
                                {error}
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border">
                                <TodoTable
                                    tasks={gottados}
                                    onTaskUpdate={fetchTasks}
                                />
                            </div>
                        )}
                    </TabsContent>
                </div>
            </Tabs>

            {/* Hamburger menu in bottom right */}
            <Popover>
                <PopoverTrigger asChild>
                    <div className="fixed bottom-5 right-5 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center cursor-pointer z-10">
                        <div className="flex flex-col gap-1">
                            <span className="block w-6 h-0.5 bg-black"></span>
                            <span className="block w-6 h-0.5 bg-black"></span>
                            <span className="block w-6 h-0.5 bg-black"></span>
                        </div>
                    </div>
                </PopoverTrigger>
                <PopoverContent className="w-40" align="end">
                    <div className="flex flex-col space-y-2">
                        <CreateTaskDialog onTaskCreated={fetchTasks} />
                        <Separator />
                        <Button
                            variant="ghost"
                            className="justify-start"
                            onClick={handleLogout}
                        >
                            Logout
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
