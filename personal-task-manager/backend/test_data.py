import asyncio
import os
import sys
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import certifi

# Ensure we can find the modules
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

try:
    from beanie import init_beanie
    from models.user import User
    from models.task import Task
    from models.log import Log
    from models.my_config import get_settings

    print("Successfully imported modules")
except ImportError as e:
    print(f"Error importing modules: {e}")
    sys.exit(1)

pwd_context = CryptContext(schemes=["bcrypt"])


async def initialize_db():
    """Initialize database connection"""
    try:
        # Get connection string from settings
        my_config = get_settings()
        client = AsyncIOMotorClient(
            my_config.connection_string, tlsCAFile=certifi.where()
        )
        db = client["gottaDo_app"]
        await init_beanie(database=db, document_models=[User, Task, Log])
        print("Database connection initialized")
        return True
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return False


async def clear_all_data():
    """Clear all data from the database"""
    print("Clearing all data from database...")
    try:
        tasks = await Task.find_all().to_list()
        tasks_count = len(tasks)

        logs = await Log.find_all().to_list()
        logs_count = len(logs)

        users = await User.find_all().to_list()
        users_count = len(users)

        await Task.delete_all()
        await Log.delete_all()
        await User.delete_all()

        print(
            f"Deleted {tasks_count} tasks, {logs_count} logs, and {users_count} users."
        )
        print("Database completely cleared!")
        return True
    except Exception as e:
        print(f"Error clearing database: {e}")
        return False


async def clear_test_accounts_data():
    """Clear only test accounts (testuser and admin) and their associated data"""
    print("Clearing test accounts and their data...")
    test_usernames = ["testuser", "admin"]

    # Safety check: make sure we're not accidentally including other usernames
    if "gabe" in test_usernames or len(test_usernames) > 2:
        print(
            "⚠️ ERROR: Attempted to delete non-test account data. Operation aborted for safety."
        )
        return False

    try:
        # Print what we're about to delete for confirmation
        test_users = await User.find({"username": {"$in": test_usernames}}).to_list()
        if not test_users:
            print("No test users found. Nothing to delete.")
            return True

        usernames = [user.username for user in test_users]
        print(f"Found {len(test_users)} test users to delete: {', '.join(usernames)}")

        # Count tasks before deletion for verification
        tasks_before = await Task.find({"username": {"$in": test_usernames}}).to_list()
        task_count_before = len(tasks_before)
        print(f"Found {task_count_before} tasks owned by test users")

        # Verify we're not touching other users' data
        all_tasks = await Task.find_all().to_list()
        total_tasks = len(all_tasks)
        other_tasks = total_tasks - task_count_before
        print(
            f"There are {other_tasks} tasks owned by other users (these will NOT be deleted)"
        )

        # Delete tasks with explicit username filter
        delete_result = await Task.find({"username": {"$in": test_usernames}}).delete()
        tasks_deleted = delete_result if isinstance(delete_result, int) else 0

        # Delete logs with explicit username filter
        logs_before = await Log.find({"username": {"$in": test_usernames}}).to_list()
        log_count_before = len(logs_before)
        print(f"Found {log_count_before} logs for test users")
        log_delete_result = await Log.find(
            {"username": {"$in": test_usernames}}
        ).delete()
        logs_deleted = log_delete_result if isinstance(log_delete_result, int) else 0

        # Delete the test users themselves, one by one
        deleted_users = []
        for user in test_users:
            if user.username in test_usernames:  # Extra safety check
                await user.delete()
                deleted_users.append(user.username)

        # Verify deletions were successful
        remaining_test_users = await User.find(
            {"username": {"$in": test_usernames}}
        ).to_list()
        remaining_test_users = len(remaining_test_users)

        remaining_test_tasks = await Task.find(
            {"username": {"$in": test_usernames}}
        ).to_list()
        remaining_test_tasks = len(remaining_test_tasks)

        print(f"\n--- Deletion Summary ---")
        print(f"Deleted {len(deleted_users)} test users: {', '.join(deleted_users)}")
        print(f"Deleted {tasks_deleted} tasks owned by test users")
        print(f"Deleted {logs_deleted} logs for test users")

        if remaining_test_users > 0 or remaining_test_tasks > 0:
            print(
                f"⚠️ Warning: Some test data could not be deleted. Remaining: {remaining_test_users} users, {remaining_test_tasks} tasks"
            )
        else:
            print("All test data successfully cleared!")

        # Verify other users' data is untouched
        other_tasks_query = await Task.find(
            {"username": {"$nin": test_usernames}}
        ).to_list()
        other_tasks_after = len(other_tasks_query)
        if other_tasks != other_tasks_after:
            print(
                f"⚠️ WARNING: Task count for non-test users changed from {other_tasks} to {other_tasks_after}"
            )
        else:
            print(
                f"Verified: {other_tasks_after} tasks owned by other users were not affected"
            )

        return True
    except Exception as e:
        print(f"Error clearing test accounts: {e}")
        return False


async def create_test_user(username, password, email, role="user"):
    """Create a test user or return existing one"""
    try:
        # Check if user exists
        existing_user = await User.find_one(User.username == username)
        if existing_user:
            print(f"User '{username}' already exists")
            return existing_user

        # Create new user
        hashed_password = pwd_context.hash(password)
        user = User(username=username, password=hashed_password, email=email, role=role)
        await user.create()
        print(f"Created user: {username}")
        return user
    except Exception as e:
        print(f"Error creating user {username}: {e}")
        return None


async def create_test_tasks(username, count=2):
    """Create test tasks for a user across all levels"""
    levels = ["task", "todo", "gottado"]
    now = datetime.now()
    created_tasks = []
    created_logs = []

    for level in levels:
        for i in range(count):
            try:
                # Set expired date based on level
                if level == "task":
                    expired_date = now + timedelta(days=1)
                elif level == "todo":
                    expired_date = now + timedelta(days=7)
                else:  # gottado
                    expired_date = now + timedelta(days=30)

                # Create some completed tasks for variety
                completed = i % 2 == 0  # Every other task is completed
                completed_date = (
                    now if completed else datetime(year=44, month=3, day=15)
                )

                task_title = f"{level.capitalize()} {i+1}"

                # Create task
                task = Task(
                    title=task_title,
                    description=f"Test {level} #{i+1} for {username}",
                    tags=["test", level],
                    completed=completed,
                    created_date=now,
                    expired_date=expired_date,
                    completed_date=completed_date,
                    high_priority=i % 3 == 0,  # Every third task is high priority
                    level=level,
                    username=username,
                )
                await Task.insert_one(task)
                created_tasks.append(task)
                print(f"Created {level}: {task.title}")

                # Create corresponding log entry
                log = Log(
                    username=username,
                    endpoint="create_task",
                    time=now,
                    details={
                        "title": task_title,
                        "level": level,
                        "id": str(task.id),
                        "test_data": True,  # Mark as created by test script
                    },
                )
                await Log.insert_one(log)
                created_logs.append(log)
                print(f"  → Created log for task: {task_title}")

                # If task is completed, also create a completion log
                if completed:
                    completion_log = Log(
                        username=username,
                        endpoint="update_task_completion",
                        time=completed_date,
                        details={
                            "id": str(task.id),
                            "title": task_title,
                            "old_completed": False,
                            "new_completed": True,
                            "test_data": True,
                        },
                    )
                    await Log.insert_one(completion_log)
                    created_logs.append(completion_log)
                    print(f"  → Created completion log for task: {task_title}")

            except Exception as e:
                print(f"Error creating {level} task: {e}")

    print(f"Created {len(created_tasks)} tasks and {len(created_logs)} logs")
    return created_tasks


async def create_logs_for_existing_tasks(username):
    """Create logs for existing tasks that might not have logs"""
    print(f"Creating logs for existing tasks owned by {username}...")
    now = datetime.now()
    logs_created = 0

    try:
        # Find all tasks for this user
        tasks = await Task.find({"username": username}).to_list()
        if not tasks:
            print(f"No tasks found for user {username}")
            return 0

        print(f"Found {len(tasks)} tasks. Creating logs...")

        for task in tasks:
            # Create a task creation log
            creation_log = Log(
                username=username,
                endpoint="create_task",
                time=task.created_date,
                details={
                    "title": task.title,
                    "level": task.level,
                    "id": str(task.id),
                    "test_data": True,
                },
            )
            await Log.insert_one(creation_log)
            logs_created += 1

            # If task is completed, create a completion log
            if task.completed:
                completion_log = Log(
                    username=username,
                    endpoint="update_task_completion",
                    time=task.completed_date,
                    details={
                        "id": str(task.id),
                        "title": task.title,
                        "old_completed": False,
                        "new_completed": True,
                        "test_data": True,
                    },
                )
                await Log.insert_one(completion_log)
                logs_created += 1

            # Add a log for high priority tasks
            if task.high_priority:
                priority_log = Log(
                    username=username,
                    endpoint="update_task_priority",
                    time=task.created_date
                    + timedelta(minutes=5),  # 5 minutes after creation
                    details={
                        "id": str(task.id),
                        "title": task.title,
                        "old_priority": False,
                        "new_priority": True,
                        "test_data": True,
                    },
                )
                await Log.insert_one(priority_log)
                logs_created += 1

        print(f"Created {logs_created} logs for {len(tasks)} tasks")
        return logs_created

    except Exception as e:
        print(f"Error creating logs for existing tasks: {e}")
        return 0


async def main():
    # Initialize database connection
    db_init = await initialize_db()
    if not db_init:
        print("Failed to initialize database. Exiting.")
        return

    # Ask for operation
    print("\n===== TEST DATA MANAGER =====")
    print("1. Clear test accounts and their data only (testuser and admin)")
    print("2. Clear ALL data (WARNING: removes all users, tasks, and logs)")
    print("3. Create test accounts and data")
    print("4. Clear test accounts and create fresh test data")
    print("5. Show database statistics")
    print("6. Create logs for existing tasks")
    print("7. Exit")

    choice = input("\nEnter your choice (1-7): ")

    if choice == "1":
        # Clear only test accounts and their data
        await clear_test_accounts_data()

    elif choice == "2":
        # Clear ALL data with confirmation
        confirm = input(
            "\n⚠️ WARNING: This will delete ALL users, tasks, and logs. Type 'YES' to confirm: "
        )
        if confirm == "YES":
            await clear_all_data()
        else:
            print("Operation cancelled.")

    elif choice == "3":
        # Create test data without clearing
        test_user = await create_test_user("testuser", "testpass", "test@example.com")
        admin_user = await create_test_user(
            "admin", "adminpass", "admin@example.com", "admin"
        )

        # Create test tasks
        if test_user:
            await create_test_tasks(test_user.username, 2)
        if admin_user:
            await create_test_tasks(admin_user.username, 1)

        print("\nTest data creation completed!")

    elif choice == "4":
        # Clear test accounts and create fresh test data
        await clear_test_accounts_data()

        # Create test users
        test_user = await create_test_user("testuser", "testpass", "test@example.com")
        admin_user = await create_test_user(
            "admin", "adminpass", "admin@example.com", "admin"
        )

        # Create test tasks
        if test_user:
            await create_test_tasks(test_user.username, 2)
        if admin_user:
            await create_test_tasks(admin_user.username, 1)

        print("\nTest data creation completed!")

    elif choice == "5":
        # Show database statistics
        try:
            users = await User.find_all().to_list()
            users_count = len(users)

            tasks = await Task.find_all().to_list()
            tasks_count = len(tasks)

            logs = await Log.find_all().to_list()
            logs_count = len(logs)

            test_users = await User.find(
                {"username": {"$in": ["testuser", "admin"]}}
            ).to_list()
            test_users_count = len(test_users)

            test_tasks = await Task.find(
                {"username": {"$in": ["testuser", "admin"]}}
            ).to_list()
            test_tasks_count = len(test_tasks)

            test_logs = await Log.find(
                {"username": {"$in": ["testuser", "admin"]}}
            ).to_list()
            test_logs_count = len(test_logs)

            print("\n===== DATABASE STATISTICS =====")
            print(f"Total users: {users_count} (test accounts: {test_users_count})")
            print(f"Total tasks: {tasks_count} (test tasks: {test_tasks_count})")
            print(f"Total logs: {logs_count} (test logs: {test_logs_count})")

            # Show test users
            if test_users:
                print("\nTest accounts:")
                for user in test_users:
                    tasks_for_user = await Task.find(
                        {"username": user.username}
                    ).to_list()
                    user_tasks_count = len(tasks_for_user)

                    logs_for_user = await Log.find(
                        {"username": user.username}
                    ).to_list()
                    user_logs_count = len(logs_for_user)
                    print(
                        f"- {user.username} (role: {user.role}): {user_tasks_count} tasks, {user_logs_count} logs"
                    )

            # Show log endpoints breakdown
            print("\nLog endpoints breakdown:")
            pipeline = [
                {"$group": {"_id": "$endpoint", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
            ]
            endpoint_counts = await Log.aggregate(pipeline).to_list()
            for item in endpoint_counts:
                print(f"- {item['_id']}: {item['count']} logs")

            # Show most recent logs
            recent_logs = await Log.find_all().sort([("time", -1)]).limit(5).to_list()
            if recent_logs:
                print("\nMost recent logs:")
                for log in recent_logs:
                    print(
                        f"- [{log.time.strftime('%Y-%m-%d %H:%M:%S')}] {log.endpoint} by {log.username}"
                    )

        except Exception as e:
            print(f"Error retrieving database statistics: {e}")

    elif choice == "6":
        # Create logs for existing tasks
        username = input("Enter username (leave blank for all test users): ")
        if not username:
            # Process for both test users
            await create_logs_for_existing_tasks("testuser")
            await create_logs_for_existing_tasks("admin")
        else:
            await create_logs_for_existing_tasks(username)

    elif choice == "7":
        print("Exiting...")

    else:
        print("Invalid choice")


if __name__ == "__main__":
    asyncio.run(main())
