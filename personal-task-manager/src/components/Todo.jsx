import React, { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUp, ArrowDown, Calendar, FileImage, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";

export function TodoTable({ tasks = [], onTaskUpdate, onMoveItem }) {
    // Filter out completed tasks
    const activeTasks = tasks.filter((task) => !task.completed);

    return (
        <div className="w-full">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead className="w-20 text-center">Priority</TableHead>
                        <TableHead className="w-24 text-center">Details</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {activeTasks.length > 0 ? (
                        activeTasks.map((task, index) => (
                            <TableRow key={task._id}>
                                <TableCell className="font-medium">{task.title}</TableCell>
                                <TableCell className="text-center">{task.high_priority ? "✅" : ""}</TableCell>
                                <TableCell className="text-center">
                                    <TaskPopover
                                        task={task}
                                        onUpdate={onTaskUpdate}
                                        index={index}
                                        isFirst={index === 0}
                                        isLast={index === activeTasks.length - 1}
                                        onMoveUp={() => onMoveItem && onMoveItem(index, "up")}
                                        onMoveDown={() => onMoveItem && onMoveItem(index, "down")}
                                    />
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                                No active tasks found
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

function TaskPopover({ task, onUpdate, index, isFirst, isLast, onMoveUp, onMoveDown }) {
    const [title, setTitle] = useState(task.title);
    const [description, setDescription] = useState(task.description);
    const [level, setLevel] = useState(task.level);
    const [dueDate, setDueDate] = useState(new Date(task.expired_date));
    const [isEditing, setIsEditing] = useState(false);
    const [taskFiles, setTaskFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [datesPopoverOpen, setDatesPopoverOpen] = useState(false);

    // Simple notification function to replace toast
    const showNotification = (message) => {
        console.log(message);
        // We'll just log for now instead of using toasts
    };

    // Fetch task files when dialog opens
    const fetchTaskFiles = async () => {
        try {
            setLoading(true);
            const response = await fetch(`http://127.0.0.1:8000/todos/files/task/${task._id}?include_data=true`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
            });

            if (response.ok) {
                const files = await response.json();
                setTaskFiles(files);
            }
        } catch (error) {
            console.error("Error fetching task files:", error);
            showNotification("Failed to load task files");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            // Update title if changed
            if (title !== task.title) {
                const titleResponse = await fetch(`http://127.0.0.1:8000/todos/title/${task._id}`, {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(title),
                });

                if (!titleResponse.ok) {
                    throw new Error("Failed to update title");
                }
            }

            // Update description if changed
            if (description !== task.description) {
                const descResponse = await fetch(`http://127.0.0.1:8000/todos/desc/${task._id}`, {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(description),
                });

                if (!descResponse.ok) {
                    throw new Error("Failed to update description");
                }
            }

            // Update level if changed
            if (level !== task.level) {
                const levelResponse = await fetch(`http://127.0.0.1:8000/todos/level/${task._id}?level=${level}`, {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                        "Content-Type": "application/json",
                    },
                });

                if (!levelResponse.ok) {
                    throw new Error("Failed to update task level");
                }
            }

            // Update due date if changed
            if (dueDate.toISOString() !== new Date(task.expired_date).toISOString()) {
                const dateResponse = await fetch(`http://127.0.0.1:8000/todos/expired_date/${task._id}`, {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(dueDate.toISOString()),
                });

                if (!dateResponse.ok) {
                    throw new Error("Failed to update due date");
                }
            }

            setIsEditing(false);

            if (onUpdate) {
                onUpdate();
            }

            showNotification("Task updated successfully");
        } catch (error) {
            console.error("Error updating task:", error);
            showNotification("Failed to update task");
        }
    };

    const handleDelete = async () => {
        if (confirm("Are you sure you want to delete this task?")) {
            try {
                const response = await fetch(`http://127.0.0.1:8000/todos/${task._id}`, {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                });

                if (!response.ok) {
                    throw new Error("Failed to delete task");
                }

                if (onUpdate) {
                    onUpdate();
                }

                showNotification("Task deleted successfully");
            } catch (error) {
                console.error("Error deleting task:", error);
                showNotification("Failed to delete task");
            }
        }
    };

    const handleMarkComplete = async () => {
        try {
            const response = await fetch(`http://127.0.0.1:8000/todos/completed/${task._id}`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error("Failed to update task completion status");
            }

            if (onUpdate) {
                onUpdate();
            }

            showNotification(`Task ${task.completed ? "reopened" : "completed"}`);
        } catch (error) {
            console.error("Error updating task completion:", error);
            showNotification("Failed to update task status");
        }
    };

    const handlePriorityToggle = async () => {
        try {
            const response = await fetch(`http://127.0.0.1:8000/todos/high_priority/${task._id}`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error("Failed to update priority");
            }

            if (onUpdate) {
                onUpdate();
            }

            showNotification(`Priority set to ${!task.high_priority ? "high" : "normal"}`);
        } catch (error) {
            console.error("Error updating priority:", error);
            showNotification("Failed to update priority");
        }
    };

    const handleMoveUp = () => {
        if (onMoveUp && !isFirst) {
            onMoveUp();
        }
    };

    const handleMoveDown = () => {
        if (onMoveDown && !isLast) {
            onMoveDown();
        }
    };

    return (
        <Dialog
            onOpenChange={(open) => {
                if (open) fetchTaskFiles();
            }}
        >
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="hover:bg-blue-100 border-black-200">
                    Details
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                    <DialogTitle>{isEditing ? <Input value={title} onChange={(e) => setTitle(e.target.value)} className="font-medium" /> : task.title}</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="description">Description:</Label>
                        {isEditing ? (
                            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[100px]" />
                        ) : (
                            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{task.description || "No description provided."}</p>
                        )}
                    </div>

                    {isEditing && (
                        <div className="grid gap-2">
                            <Label htmlFor="level">Task Level:</Label>
                            <Select id="level" value={level} onValueChange={setLevel}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select task level" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="task">Task (1 day)</SelectItem>
                                    <SelectItem value="todo">Todo (7 days)</SelectItem>
                                    <SelectItem value="gottado">Gottado (30 days)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <Popover open={datesPopoverOpen} onOpenChange={setDatesPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="gap-1">
                                    <Calendar className="h-4 w-4" />
                                    Dates
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                                <div className="grid gap-2">
                                    <div className="flex justify-between">
                                        <span className="font-medium">Created:</span>
                                        <span>{new Date(task.created_date).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-medium">Due:</span>
                                        {isEditing ? <DatePicker selected={dueDate} onSelect={setDueDate} /> : <span>{new Date(task.expired_date).toLocaleString()}</span>}
                                    </div>
                                    {task.completed && (
                                        <div className="flex justify-between">
                                            <span className="font-medium">Completed:</span>
                                            <span>{task.completed_date && new Date(task.completed_date).getFullYear() !== 44 ? new Date(task.completed_date).toLocaleString() : "Not completed"}</span>
                                        </div>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>

                        <div className="text-sm text-muted-foreground">
                            Level: <span className="font-medium capitalize">{task.level}</span>
                        </div>

                        {task.tags && task.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {task.tags.map((tag, index) => (
                                    <span key={index} className="px-2 py-1 text-xs rounded-full bg-muted">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {taskFiles && taskFiles.length > 0 && (
                        <div className="py-2">
                            <Label className="mb-2 block">Attached Files ({taskFiles.length}):</Label>
                            <Carousel className="w-full max-w-sm mx-auto">
                                <CarouselContent>
                                    {taskFiles.map((file, index) => (
                                        <CarouselItem key={file.id || index} className="flex items-center justify-center">
                                            <div className="p-1">
                                                <Card>
                                                    <CardContent className="flex aspect-square items-center justify-center p-6">
                                                        {file.content_type?.startsWith("image/") ? (
                                                            <img src={file.data} alt={file.filename || `File ${index}`} className="max-w-full max-h-full object-contain" />
                                                        ) : (
                                                            <div className="text-center">
                                                                <FileImage className="h-10 w-10 mx-auto mb-2" />
                                                                <p className="text-sm truncate max-w-[150px]">{file.filename}</p>
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        </CarouselItem>
                                    ))}
                                </CarouselContent>
                                <div className="flex items-center justify-center mt-2">
                                    <CarouselPrevious className="static transform-none mx-2" />
                                    <CarouselNext className="static transform-none mx-2" />
                                </div>
                            </Carousel>
                        </div>
                    )}

                    <Separator />

                    <div className="flex justify-between items-center">
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleMoveUp} disabled={isFirst}>
                                <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleMoveDown} disabled={isLast}>
                                <ArrowDown className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="flex gap-2">
                            <Button variant={task.high_priority ? "default" : "outline"} size="sm" onClick={handlePriorityToggle}>
                                <AlertCircle className="h-4 w-4 mr-1" />
                                {task.high_priority ? "High" : "Normal"}
                            </Button>
                            <Button variant={task.completed ? "default" : "outline"} size="sm" onClick={handleMarkComplete}>
                                {task.completed ? "Reopen" : "Complete"}
                            </Button>
                            <Button variant="destructive" size="sm" onClick={handleDelete}>
                                Delete
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between">
                    {isEditing ? (
                        <>
                            <Button variant="outline" onClick={() => setIsEditing(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleSave}>Save Changes</Button>
                        </>
                    ) : (
                        <Button variant="outline" onClick={() => setIsEditing(true)}>
                            Edit
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
