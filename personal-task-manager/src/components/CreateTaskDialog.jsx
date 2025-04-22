import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, FileUp, PlusCircle } from "lucide-react";

export function CreateTaskDialog({ onTaskCreated }) {
    const [title, setTitle] = useState("New Task");
    const [description, setDescription] = useState("");
    const [level, setLevel] = useState("task");
    const [dueDate, setDueDate] = useState(new Date());
    const [tags, setTags] = useState("");
    const [priority, setPriority] = useState(false);
    const [files, setFiles] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);

    // Reset form when dialog closes
    const handleOpenChange = (open) => {
        setDialogOpen(open);
        if (!open) {
            // Reset form
            setTitle("New Task");
            setDescription("");
            setLevel("task");
            setDueDate(new Date());
            setTags("");
            setPriority(false);
            setFiles([]);
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files) {
            // Convert FileList to Array and store
            setFiles(Array.from(e.target.files));
        }
    };

    const handleSubmit = async () => {
        try {
            setIsSubmitting(true);

            // Parse tags from comma-separated string to array
            const tagsArray = tags
                .split(",")
                .map((tag) => tag.trim())
                .filter((tag) => tag !== "");

            // Create the task
            const taskData = {
                title,
                description,
                level,
                tags: tagsArray,
                high_priority: priority,
                created_date: new Date().toISOString(),
                expired_date: dueDate.toISOString(),
                has_image: files.length > 0,
            };

            // Send task creation request
            const taskResponse = await fetch(
                "http://127.0.0.1:8000/todos/create",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(taskData),
                }
            );

            if (!taskResponse.ok) {
                throw new Error("Failed to create task");
            }

            const createdTask = await taskResponse.json();

            // If there are files, upload them
            if (files.length > 0) {
                for (const file of files) {
                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("description", `File for task: ${title}`);
                    formData.append("task_id", createdTask._id);

                    try {
                        const fileResponse = await fetch(
                            "http://127.0.0.1:8000/todos/files/upload",
                            {
                                method: "POST",
                                headers: {
                                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                                    // Do NOT set Content-Type here - the browser will set it with the correct boundary for FormData
                                },
                                body: formData,
                            }
                        );

                        if (!fileResponse.ok) {
                            const errorData = await fileResponse.json();
                            console.error(
                                "Failed to upload file:",
                                file.name,
                                errorData
                            );
                        }
                    } catch (error) {
                        console.error("Error during file upload:", error);
                    }
                }
            }

            // Close dialog and notify parent
            setDialogOpen(false);
            if (onTaskCreated) {
                onTaskCreated();
            }
        } catch (error) {
            console.error("Error creating task:", error);
            alert("Failed to create task");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" className="justify-start gap-1">
                    <PlusCircle className="h-4 w-4" />
                    Task
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                    <DialogTitle>Create New Task</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="title">Title</Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Task title"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Task description"
                            className="min-h-[100px]"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="level">Task Level</Label>
                            <Select
                                id="level"
                                value={level}
                                onValueChange={setLevel}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select task level" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="task">
                                        Task (1 day)
                                    </SelectItem>
                                    <SelectItem value="todo">
                                        Todo (7 days)
                                    </SelectItem>
                                    <SelectItem value="gottado">
                                        Gottado (30 days)
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label>Due Date</Label>
                            <DatePicker
                                selected={dueDate}
                                onSelect={setDueDate}
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="tags">Tags (comma-separated)</Label>
                        <Input
                            id="tags"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            placeholder="work, urgent, project"
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <Button
                            type="button"
                            variant={priority ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPriority(!priority)}
                            className="gap-1"
                        >
                            <AlertCircle className="h-4 w-4" />
                            {priority ? "High Priority" : "Normal Priority"}
                        </Button>
                    </div>

                    <Separator />

                    <div className="grid gap-2">
                        <Label htmlFor="files">Attach Files</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id="files"
                                type="file"
                                multiple
                                onChange={handleFileChange}
                                className="flex-1"
                            />
                        </div>
                        {files.length > 0 && (
                            <div className="text-sm text-muted-foreground">
                                {files.length} file(s) selected
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => setDialogOpen(false)}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? "Creating..." : "Create Task"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
