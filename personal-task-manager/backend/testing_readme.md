# Testing Tools for Personal Task Manager

This directory contains simple scripts for testing the backend API.

## Requirements

Install the required libraries:

```bash
pip install httpx rich
```

These are in addition to the libraries already in requirements.txt.

## Available Scripts

### 1. Test Data Manager (`test_data.py`)

This script allows you to create test data or clear the database.

**Usage:**

```bash
python test_data.py
```

**Features:**

- Clear the database (tasks and logs)
- Create test users and tasks
- Both clear and create in one operation

### 2. Endpoint Tester (`test_endpoints.py`)

This script tests all the API endpoints in sequence and displays the results.

**Usage:**

```bash
python test_endpoints.py
```

**What it tests:**

1. Authentication (gets a token via sign-in)
2. Gets all tasks
3. Creates a task for each level (task, todo, gottado)
4. Gets tasks by level
5. Gets completed tasks
6. Updates various task properties (title, description, priority, completion)
7. Deletes a task

**Note:** The script uses the username "testuser" and password "testpass" by default. Make sure this user exists in your database by running `test_data.py` first.

## Testing Workflow

A typical testing workflow:

1. Start your FastAPI server:

    ```bash
    uvicorn main:app --reload
    ```

2. Create test data:

    ```bash
    python test_data.py
    ```

    Select option 3 to clear and create test data.

3. Run endpoint tests:

    ```bash
    python test_endpoints.py
    ```

4. Review the output to see if all endpoints are working correctly.

## Customizing Tests

- In `test_data.py`: You can modify the `create_test_tasks` function to create different types of tasks.
- In `test_endpoints.py`: You can change the `BASE_URL`, `USERNAME`, and `PASSWORD` variables at the top of the file.

## Troubleshooting

- If authentication fails, make sure the test user exists in your database
- If endpoints return 404, check that your server is running and the routes are correctly defined
- If you get permission errors (403), check that the authenticated user has proper access
