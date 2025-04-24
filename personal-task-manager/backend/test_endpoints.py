import asyncio
import os
import sys
import httpx
import json
from datetime import datetime

# Ensure we can find the modules
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from beanie import init_beanie
    from motor.motor_asyncio import AsyncIOMotorClient
    from models.my_config import get_settings
    from models.task import Task
    import certifi

    print("Successfully imported modules")
except ImportError as e:
    print(f"Error importing modules: {e}")
    print("Please install required packages with: pip install httpx rich")
    sys.exit(1)

console = Console()

# Change this to match your local server
BASE_URL = "http://localhost:8000"
USERNAME = "testuser"
PASSWORD = "testpass"

# For storing created task IDs
created_tasks = []


async def verify_task_exists(task_id):
    """Verify a task exists directly in the database"""
    try:
        # Connect to the database directly
        my_config = get_settings()
        client = AsyncIOMotorClient(
            my_config.connection_string, tlsCAFile=certifi.where()
        )
        db = client["gottaDo_app"]
        await init_beanie(database=db, document_models=[Task])

        # Try to find the task by ID
        task = await Task.get(task_id)

        if task:
            console.print(f"[green]Task verified in database: {task.title}[/green]")
            return True
        else:
            console.print(f"[red]Task with ID {task_id} not found in database[/red]")
            return False

    except Exception as e:
        console.print(f"[red]Error verifying task in database: {str(e)}[/red]")
        return False


async def print_response(description, response):
    """Print formatted response details"""
    status = response.status_code
    color = "green" if 200 <= status < 300 else "red"

    try:
        body = response.json()
        formatted_json = json.dumps(body, indent=2)
    except:
        body = response.text
        formatted_json = body

    console.print(f"[bold]{description}[/bold]")
    console.print(f"Status: [{color}]{status}[/{color}]")
    console.print(f"Response:", style="dim")
    console.print(Panel(formatted_json, expand=False))
    console.print("\n" + "-" * 50 + "\n")

    return body


async def login_user():
    """Login and get auth token"""
    console.print("\n[bold blue]AUTHENTICATION[/bold blue]")

    login_data = {"username": USERNAME, "password": PASSWORD}

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{BASE_URL}/users/sign-in",
                data=login_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=10.0,  # Add timeout
            )

            result = await print_response("Login", response)

            if 200 <= response.status_code < 300:
                return result.get("access_token")
            else:
                console.print(
                    f"[red]Login failed with status code: {response.status_code}[/red]"
                )
                return None

    except httpx.RequestError as e:
        console.print(f"[bold red]Request error during login: {str(e)}[/bold red]")
        console.print(
            f"[yellow]Make sure your server is running at {BASE_URL}[/yellow]"
        )
        return None


async def test_task_endpoints(token):
    """Test all task endpoints in sequence"""
    if not token:
        console.print(
            "[bold red]Authentication failed. Cannot proceed with tests.[/bold red]"
        )
        return

    headers = {"Authorization": f"Bearer {token}"}

    console.print("\n[bold blue]TASK ENDPOINTS TEST[/bold blue]")

    async with httpx.AsyncClient() as client:
        # 1. Get all tasks (should be empty if we just cleared)
        console.print("\n[bold cyan]1. Getting all tasks...[/bold cyan]")
        try:
            response = await client.get(
                f"{BASE_URL}/todos/all", headers=headers, timeout=10.0
            )
            await print_response("Get All Tasks", response)
        except httpx.RequestError as e:
            console.print(f"[red]Error getting all tasks: {str(e)}[/red]")

        # 2. Create tasks for each level
        console.print("\n[bold cyan]2. Creating new tasks...[/bold cyan]")
        for level in ["task", "todo", "gottado"]:
            try:
                task_data = {
                    "title": f"Test {level}",
                    "description": f"This is a test {level} created via API",
                    "tags": ["test", "api", level],
                    "completed": False,
                    "created_date": datetime.now().isoformat(),
                    "expired_date": datetime.now().isoformat(),
                    "level": level,
                    "high_priority": level == "gottado",  # Make gottados high priority
                }

                response = await client.post(
                    f"{BASE_URL}/todos/create",
                    json=task_data,
                    headers=headers,
                    timeout=10.0,
                )

                result = await print_response(f"Create {level.capitalize()}", response)

                if 200 <= response.status_code < 300 and result.get("id"):
                    task_id = result.get("id")
                    created_tasks.append(task_id)

                    # Verify task exists in database
                    console.print(
                        f"[bold]Verifying task was stored in database...[/bold]"
                    )
                    await verify_task_exists(task_id)
            except httpx.RequestError as e:
                console.print(f"[red]Error creating {level}: {str(e)}[/red]")

        # Only continue if we successfully created tasks
        if not created_tasks:
            console.print(
                "[bold yellow]No tasks were created. Skipping remaining tests.[/bold yellow]"
            )
            return

        # 3. Get tasks by level
        console.print("\n[bold cyan]3. Getting tasks by level...[/bold cyan]")
        for level in ["tasks", "todos", "gottados"]:
            try:
                response = await client.get(
                    f"{BASE_URL}/todos/{level}", headers=headers, timeout=10.0
                )
                await print_response(f"Get {level.capitalize()}", response)
            except httpx.RequestError as e:
                console.print(f"[red]Error getting {level}: {str(e)}[/red]")

        # 4. Get completed tasks (should be empty as we just created uncompleted tasks)
        console.print("\n[bold cyan]4. Getting completed tasks...[/bold cyan]")
        try:
            response = await client.get(
                f"{BASE_URL}/todos/completed", headers=headers, timeout=10.0
            )
            await print_response("Get Completed", response)
        except Exception as e:
            console.print(f"[red]Error getting completed tasks: {str(e)}[/red]")

        # 5. Update task properties
        if created_tasks:
            task_id = created_tasks[0]
            console.print(f"\n[bold cyan]5. Updating task {task_id}...[/bold cyan]")

            # 5.1 Update title
            try:
                response = await client.patch(
                    f"{BASE_URL}/todos/title/{task_id}",
                    json="Updated Title",
                    headers=headers,
                    timeout=10.0,
                )
                await print_response("Update Title", response)
            except httpx.RequestError as e:
                console.print(f"[red]Error updating title: {str(e)}[/red]")

            # 5.2 Update description
            try:
                response = await client.patch(
                    f"{BASE_URL}/todos/desc/{task_id}",
                    json="This description has been updated via API test",
                    headers=headers,
                    timeout=10.0,
                )
                await print_response("Update Description", response)
            except httpx.RequestError as e:
                console.print(f"[red]Error updating description: {str(e)}[/red]")

            # 5.3 Toggle priority
            try:
                response = await client.patch(
                    f"{BASE_URL}/todos/high_priority/{task_id}",
                    headers=headers,
                    timeout=10.0,
                )
                await print_response("Toggle Priority", response)
            except httpx.RequestError as e:
                console.print(f"[red]Error toggling priority: {str(e)}[/red]")

            # 5.4 Mark as completed
            try:
                response = await client.patch(
                    f"{BASE_URL}/todos/completed/{task_id}",
                    headers=headers,
                    timeout=10.0,
                )
                await print_response("Mark Completed", response)
            except httpx.RequestError as e:
                console.print(f"[red]Error marking as completed: {str(e)}[/red]")

            # 5.5 Check if completed tasks now has our task
            try:
                response = await client.get(
                    f"{BASE_URL}/todos/completed", headers=headers, timeout=10.0
                )
                await print_response("Get Completed (After Update)", response)
            except httpx.RequestError as e:
                console.print(f"[red]Error getting completed tasks: {str(e)}[/red]")

        # 6. Delete a task
        if len(created_tasks) > 1:
            task_id = created_tasks[1]
            console.print(f"\n[bold cyan]6. Deleting task {task_id}...[/bold cyan]")

            try:
                response = await client.delete(
                    f"{BASE_URL}/todos/{task_id}", headers=headers, timeout=10.0
                )
                await print_response("Delete Task", response)

                # Verify task was deleted from database
                console.print(
                    f"[bold]Verifying task was deleted from database...[/bold]"
                )
                exists = await verify_task_exists(task_id)
                if not exists:
                    console.print(
                        f"[green]Task successfully deleted from database[/green]"
                    )

            except httpx.RequestError as e:
                console.print(f"[red]Error deleting task: {str(e)}[/red]")

            # Verify deletion
            try:
                response = await client.get(
                    f"{BASE_URL}/todos/all", headers=headers, timeout=10.0
                )
                await print_response("Get All Tasks (After Delete)", response)
            except httpx.RequestError as e:
                console.print(f"[red]Error getting all tasks: {str(e)}[/red]")


async def main():
    console.print("[bold green]===== ENDPOINT TESTING TOOL =====\n[/bold green]")

    # Print configuration
    console.print(f"[bold]Server URL:[/bold] {BASE_URL}")
    console.print(f"[bold]Test User:[/bold] {USERNAME}")
    console.print(f"[bold]Database:[/bold] gottaDo_app")
    console.print(
        "[bold yellow]Note:[/bold yellow] Make sure the server is running and the test user exists"
    )

    # Step 1: Login and get token
    token = await login_user()

    # Step 2: Test task endpoints
    if token:
        await test_task_endpoints(token)

        # Print summary
        console.print("\n[bold green]===== TEST SUMMARY =====\n[/bold green]")
        if created_tasks:
            console.print(f"[green]Created tasks: {len(created_tasks)}[/green]")
            for task_id in created_tasks:
                exists = await verify_task_exists(task_id)
                if exists:
                    console.print(f"[green]Task {task_id} exists in database[/green]")
                else:
                    console.print(
                        f"[red]Task {task_id} does not exist in database[/red]"
                    )

            console.print(
                f"[yellow]Note: You may want to clean up these tasks using test_data.py[/yellow]"
            )
        else:
            console.print("[yellow]No tasks were created during testing[/yellow]")
    else:
        console.print("[bold red]Testing failed: Could not authenticate[/bold red]")
        console.print(
            "[yellow]Make sure your server is running and that the test user exists[/yellow]"
        )
        console.print(
            "[yellow]You can create a test user with 'python test_data.py'[/yellow]"
        )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        console.print(f"[bold red]Error:[/bold red] {str(e)}")
        console.print(
            "[yellow]Tip: Make sure your server is running at " + BASE_URL + "[/yellow]"
        )
