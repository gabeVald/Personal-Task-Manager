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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToastProvider } from "@/components/ui/toast";
import { ScrollArea } from "@/components/ui/scroll-area";

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
                throw new Error(`Error fetching tasks: ${allResponse.statusText}`);
            }

            const allData = await allResponse.json();
            setAllTasks(allData);

            // Tasks
            const tasksResponse = await fetch("http://127.0.0.1:8000/todos/tasks", { headers });
            const tasksData = await tasksResponse.json();
            // Sort tasks by due date
            const sortedTasks = [...tasksData].sort((a, b) => {
                if (!a.expired_date && !b.expired_date) return 0;
                if (!a.expired_date) return 1;
                if (!b.expired_date) return -1;
                return new Date(a.expired_date) - new Date(b.expired_date);
            });
            setTasks(sortedTasks);

            // Todos
            const todosResponse = await fetch("http://127.0.0.1:8000/todos/todos", { headers });
            const todosData = await todosResponse.json();
            // Sort todos by due date
            const sortedTodos = [...todosData].sort((a, b) => {
                if (!a.expired_date && !b.expired_date) return 0;
                if (!a.expired_date) return 1;
                if (!b.expired_date) return -1;
                return new Date(a.expired_date) - new Date(b.expired_date);
            });
            setTodos(sortedTodos);

            // Gottados
            const gottadosResponse = await fetch("http://127.0.0.1:8000/todos/gottados", { headers });
            const gottadosData = await gottadosResponse.json();
            // Sort gottados by due date
            const sortedGottados = [...gottadosData].sort((a, b) => {
                if (!a.expired_date && !b.expired_date) return 0;
                if (!a.expired_date) return 1;
                if (!b.expired_date) return -1;
                return new Date(a.expired_date) - new Date(b.expired_date);
            });
            setGottados(sortedGottados);
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
    const handleMoveItem = (index, direction, taskType = "tasks") => {
        console.log("Moving item:", { index, direction, taskType });
        console.log("Current tasks:", tasks);

        let currentList;
        let setCurrentList;

        // Determine which list we're working with
        switch (taskType) {
            case "tasks":
                currentList = [...tasks]; // Create a new array to ensure state update
                setCurrentList = setTasks;
                break;
            case "todos":
                currentList = [...todos]; // Create a new array to ensure state update
                setCurrentList = setTodos;
                break;
            case "gottados":
                currentList = [...gottados]; // Create a new array to ensure state update
                setCurrentList = setGottados;
                break;
            default:
                return;
        }

        console.log("Current list before swap:", currentList);

        if (direction === "up" && index > 0) {
            // Swap items
            [currentList[index], currentList[index - 1]] = [currentList[index - 1], currentList[index]];
            console.log("List after up swap:", currentList);
            // Update state with new array
            setCurrentList([...currentList]); // Create another new array to force update
        } else if (direction === "down" && index < currentList.length - 1) {
            // Swap items
            [currentList[index], currentList[index + 1]] = [currentList[index + 1], currentList[index]];
            console.log("List after down swap:", currentList);
            // Update state with new array
            setCurrentList([...currentList]); // Create another new array to force update
        }
    };

    // Update the TodoTable components to use the same function reference
    const handleTasksMove = (index, direction) => handleMoveItem(index, direction, "tasks");
    const handleTodosMove = (index, direction) => handleMoveItem(index, direction, "todos");
    const handleGottadosMove = (index, direction) => handleMoveItem(index, direction, "gottados");

    return (
        <div className={`min-h-screen flex flex-col ${geistSans.variable} font-sans`}>
            <Tabs defaultValue="All" className="flex-1 flex flex-col">
                {/* Top nav/header */}
                <header className="w-full p-4 bg-neutral-100 border-b flex justify-between items-center">
                    <TabsList className="flex justify-between items-center w-full">
                        <TabsTrigger value="All">All</TabsTrigger>
                        <TabsTrigger value="Tasks">Tasks</TabsTrigger>
                        <TabsTrigger value="Todos">Todos</TabsTrigger>
                        <TabsTrigger value="Gottados">Gottados</TabsTrigger>
                    </TabsList>
                </header>

                {/* Tab content wrapper with z-index control */}
                <div className="relative z-0 flex-1">
                    <TabsContent value="All" className="flex-1 p-4">
                        {loading ? (
                            <div className="h-[200px] flex items-center justify-center text-gray-500">Loading tasks...</div>
                        ) : error ? (
                            <div className="h-[200px] flex items-center justify-center text-red-500">{error}</div>
                        ) : (
                            <div className="flex flex-col lg:flex-row lg:space-x-4 space-y-8 lg:space-y-0 min-h-0">
                                <div className="lg:flex-1 min-h-0 flex flex-col">
                                    <h2 className="text-xl font-semibold mb-4">Tasks ({tasks.length})</h2>
                                    <div className="min-h-0 flex-1">
                                        <ScrollArea className="h-[195px] lg:h-[calc(100vh-300px)] rounded-lg border">
                                            <div className="overflow-x-auto">
                                                <TodoTable tasks={tasks} onTaskUpdate={fetchTasks} onMoveItem={handleTasksMove} />
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </div>

                                <div className="lg:flex-1 min-h-0 flex flex-col">
                                    <h2 className="text-xl font-semibold mb-4">Todos ({todos.length})</h2>
                                    <div className="min-h-0 flex-1">
                                        <ScrollArea className="h-[195px] lg:h-[calc(100vh-300px)] rounded-lg border">
                                            <div className="overflow-x-auto">
                                                <TodoTable tasks={todos} onTaskUpdate={fetchTasks} onMoveItem={handleTodosMove} />
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </div>

                                <div className="lg:flex-1 min-h-0 flex flex-col">
                                    <h2 className="text-xl font-semibold mb-4">Gottados ({gottados.length})</h2>
                                    <div className="min-h-0 flex-1">
                                        <ScrollArea className="h-[195px] lg:h-[calc(100vh-300px)] rounded-lg border">
                                            <div className="overflow-x-auto">
                                                <TodoTable tasks={gottados} onTaskUpdate={fetchTasks} onMoveItem={handleGottadosMove} />
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="Tasks" className="flex-1 p-4">
                        {loading ? (
                            <div className="h-[200px] flex items-center justify-center text-gray-500">Loading tasks...</div>
                        ) : error ? (
                            <div className="h-[200px] flex items-center justify-center text-red-500">{error}</div>
                        ) : (
                            <div className="flex flex-col lg:flex-row lg:space-x-4 space-y-8 lg:space-y-0 min-h-0">
                                <div className="lg:flex-1 min-h-0 flex flex-col">
                                    <h2 className="text-xl font-semibold mb-4">Tasks ({tasks.length})</h2>
                                    <div className="min-h-0 flex-1">
                                        <ScrollArea className=" lg:h-[calc(100vh-300px)] rounded-lg border">
                                            <div className="overflow-x-auto">
                                                <TodoTable tasks={tasks} onTaskUpdate={fetchTasks} onMoveItem={handleTasksMove} />
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="Todos" className="flex-1 p-4">
                        {loading ? (
                            <div className="h-[200px] flex items-center justify-center text-gray-500">Loading todos...</div>
                        ) : error ? (
                            <div className="h-[200px] flex items-center justify-center text-red-500">{error}</div>
                        ) : (
                            <div className="flex flex-col lg:flex-row lg:space-x-4 space-y-8 lg:space-y-0 min-h-0">
                                <div className="lg:flex-1 min-h-0 flex flex-col">
                                    <h2 className="text-xl font-semibold mb-4">Todos ({todos.length})</h2>
                                    <div className="min-h-0 flex-1">
                                        <ScrollArea className=" lg:h-[calc(100vh-300px)] rounded-lg border">
                                            <div className="overflow-x-auto">
                                                <TodoTable tasks={todos} onTaskUpdate={fetchTasks} onMoveItem={handleTodosMove} />
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="Gottados" className="flex-1 p-4">
                        {loading ? (
                            <div className="h-[200px] flex items-center justify-center text-gray-500">Loading gottados...</div>
                        ) : error ? (
                            <div className="h-[200px] flex items-center justify-center text-red-500">{error}</div>
                        ) : (
                            <div className="flex flex-col lg:flex-row lg:space-x-4 space-y-8 lg:space-y-0 min-h-0">
                                <div className="lg:flex-1 min-h-0 flex flex-col">
                                    <h2 className="text-xl font-semibold mb-4">Gottados ({gottados.length})</h2>
                                    <div className="min-h-0 flex-1">
                                        <ScrollArea className=" lg:h-[calc(100vh-300px)] rounded-lg border">
                                            <div className="overflow-x-auto">
                                                <TodoTable tasks={gottados} onTaskUpdate={fetchTasks} onMoveItem={handleGottadosMove} />
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </div>
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
                <PopoverContent className="w-40 flex items-center justify-center" align="end">
                    <div className="flex flex-col space-y-2">
                        <CreateTaskDialog onTaskCreated={fetchTasks} />
                        <Separator />
                        <Button variant="ghost" className="justify-start" onClick={handleLogout}>
                            Logout
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
