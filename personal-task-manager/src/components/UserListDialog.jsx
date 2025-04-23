import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Copy, Save, Trash2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";

export function UserListDialog() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingAction, setLoadingAction] = useState(false);
    const [open, setOpen] = useState(false);
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState("");
    const [userRole, setUserRole] = useState("");
    const { toast } = useToast();

    // Fetch users from the API
    const fetchUsers = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem("token");
            const response = await fetch("http://127.0.0.1:8000/users/all", {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(`Error fetching users: ${response.statusText}`);
            }

            const data = await response.json();
            // Transform the data into format needed for combobox if necessary
            setUsers(
                data.map((user) => ({
                    value: user.username,
                    label: user.username,
                    role: user.role,
                }))
            );
        } catch (error) {
            console.error("Error fetching users:", error);
            toast({
                title: "Error",
                description: "Failed to load users. You may not have permission.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchUsers();
        }
    }, [open]);

    // Set user role when selecting a user
    useEffect(() => {
        if (selectedUser) {
            const selectedUserData = users.find((user) => user.value === selectedUser);
            if (selectedUserData) {
                setUserRole(selectedUserData.role);
            }
        } else {
            setUserRole("");
        }
    }, [selectedUser, users]);

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(
            () => {
                toast({
                    title: "Copied!",
                    description: `User copied to clipboard`,
                });
            },
            (err) => {
                toast({
                    title: "Copy failed",
                    description: "Could not copy text",
                    variant: "destructive",
                });
            }
        );
    };

    const handleUpdateRole = async () => {
        if (!selectedUser || !userRole) return;

        try {
            setLoadingAction(true);
            const token = localStorage.getItem("token");
            const response = await fetch(`http://127.0.0.1:8000/users/${selectedUser}/role?role=${userRole}`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Error updating role: ${response.statusText}`);
            }

            const data = await response.json();
            toast({
                title: "Success",
                description: data.message,
            });

            // Update local state to reflect the change
            setUsers((prev) => prev.map((user) => (user.value === selectedUser ? { ...user, role: userRole } : user)));
        } catch (error) {
            console.error("Error updating role:", error);
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoadingAction(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!selectedUser) return;

        try {
            setLoadingAction(true);
            const token = localStorage.getItem("token");
            const response = await fetch(`http://127.0.0.1:8000/users/${selectedUser}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Error deleting user: ${response.statusText}`);
            }

            const data = await response.json();
            toast({
                title: "Success",
                description: data.message,
            });

            // Update local state to remove the deleted user
            setUsers((prev) => prev.filter((user) => user.value !== selectedUser));
            // Reset selection
            setSelectedUser("");
            setUserRole("");
        } catch (error) {
            console.error("Error deleting user:", error);
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoadingAction(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" className="justify-start">
                    User Management
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Manage Users</DialogTitle>
                    <DialogDescription>View, edit roles, and manage user accounts.</DialogDescription>
                </DialogHeader>

                <div className="flex flex-col space-y-4">
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" aria-expanded={popoverOpen} className="w-full justify-between">
                                {selectedUser ? users.find((user) => user.value === selectedUser)?.label : "Select user..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                            <Command>
                                <CommandInput placeholder="Search users..." />
                                <CommandList>
                                    <CommandEmpty>No users found.</CommandEmpty>
                                    <CommandGroup>
                                        {users.map((user) => (
                                            <CommandItem
                                                key={user.value}
                                                value={user.value}
                                                onSelect={(currentValue) => {
                                                    if (currentValue !== selectedUser) {
                                                        setSelectedUser(currentValue);
                                                        copyToClipboard(currentValue);
                                                    } else {
                                                        setSelectedUser("");
                                                    }
                                                    setPopoverOpen(false);
                                                }}
                                            >
                                                <Check className={cn("mr-2 h-4 w-4", selectedUser === user.value ? "opacity-100" : "opacity-0")} />
                                                <span>{user.label}</span>
                                                <span className="ml-auto text-xs text-muted-foreground">{user.role}</span>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                    {selectedUser && (
                        <>
                            <div className="flex items-center gap-2 mt-2"></div>

                            <div className="space-y-2">
                                <div className="text-sm font-medium">User Role</div>
                                <Select value={userRole} onValueChange={setUserRole}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="user">User</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Button variant="outline" className="w-full mt-2 flex items-center gap-2" onClick={handleUpdateRole} disabled={loadingAction}>
                                    <Save className="h-4 w-4" />
                                    Save Role
                                </Button>
                            </div>

                            <Separator className="my-2" />

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" className="w-full flex items-center gap-2">
                                        <Trash2 className="h-4 w-4" />
                                        Delete User
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>This action cannot be undone. This will permanently delete the user account and all associated data.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground">
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className="h-4 w-4" />
                                                Delete
                                            </div>
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
