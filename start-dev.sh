#!/bin/bash
# Script to start Personal Task Manager development environment
# Save as start-dev.sh

# Get the root directory (assuming script is in the project root)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/personal-task-manager/backend"
FRONTEND_DIR="$ROOT_DIR/personal-task-manager"

# Create a script for the backend process
cat > /tmp/backend_startup.sh << 'EOL'
#!/bin/bash
cd "$1" || exit
echo "Activating virtual environment..."
source venv/bin/activate
echo "Starting backend server..."
# Set window title
echo -ne "\033]0;Backend Server\007"
uvicorn main:app --reload
EOL

# Create a script for the frontend process
cat > /tmp/frontend_startup.sh << 'EOL'
#!/bin/bash
cd "$1" || exit
echo "Starting frontend development server..."
# Set window title
echo -ne "\033]0;Frontend Server\007"
npm run dev
EOL

chmod +x /tmp/backend_startup.sh /tmp/frontend_startup.sh

# Function to get window ID by title (may need to wait a bit)
get_window_id() {
    local title="$1"
    local max_attempts=10
    local attempt=0
    local window_id=""
    
    while [ $attempt -lt $max_attempts ] && [ -z "$window_id" ]; do
        window_id=$(xdotool search --name "$title" | head -1)
        if [ -z "$window_id" ]; then
            sleep 0.5
            ((attempt++))
        fi
    done
    
    echo "$window_id"
}

# Detect terminal emulator and start processes
if command -v gnome-terminal > /dev/null; then
    # Start backend
    gnome-terminal --title="Backend Server" -- /tmp/backend_startup.sh "$BACKEND_DIR"
    sleep 2
    backend_window=$(get_window_id "Backend Server")
    if [ -n "$backend_window" ] && command -v xdotool > /dev/null; then
        xdotool windowminimize "$backend_window"
    fi
    
    sleep 3  # Give backend time to start
    
    # Start frontend
    gnome-terminal --title="Frontend Server" -- /tmp/frontend_startup.sh "$FRONTEND_DIR"
    sleep 2
    frontend_window=$(get_window_id "Frontend Server")
    if [ -n "$frontend_window" ] && command -v xdotool > /dev/null; then
        xdotool windowminimize "$frontend_window"
    fi
    
elif command -v xterm > /dev/null; then
    # Start backend in xterm
    xterm -title "Backend Server" -e "/tmp/backend_startup.sh \"$BACKEND_DIR\"" &
    sleep 2
    backend_window=$(get_window_id "Backend Server")
    if [ -n "$backend_window" ] && command -v xdotool > /dev/null; then
        xdotool windowminimize "$backend_window"
    fi
    
    sleep 3  # Give backend time to start
    
    # Start frontend in xterm
    xterm -title "Frontend Server" -e "/tmp/frontend_startup.sh \"$FRONTEND_DIR\"" &
    sleep 2
    frontend_window=$(get_window_id "Frontend Server")
    if [ -n "$frontend_window" ] && command -v xdotool > /dev/null; then
        xdotool windowminimize "$frontend_window"
    fi
    
elif command -v konsole > /dev/null; then
    # Start backend in konsole
    konsole --title "Backend Server" -e "/tmp/backend_startup.sh \"$BACKEND_DIR\"" &
    sleep 2
    backend_window=$(get_window_id "Backend Server")
    if [ -n "$backend_window" ] && command -v xdotool > /dev/null; then
        xdotool windowminimize "$backend_window"
    fi
    
    sleep 3  # Give backend time to start
    
    # Start frontend in konsole
    konsole --title "Frontend Server" -e "/tmp/frontend_startup.sh \"$FRONTEND_DIR\"" &
    sleep 2
    frontend_window=$(get_window_id "Frontend Server")
    if [ -n "$frontend_window" ] && command -v xdotool > /dev/null; then
        xdotool windowminimize "$frontend_window"
    fi
    
else
    echo "Could not find a suitable terminal emulator. Please install gnome-terminal, xterm, or konsole."
    exit 1
fi

# Open Firefox browser to localhost:3000
sleep 5  # Give frontend time to start
if command -v firefox > /dev/null; then
    firefox http://localhost:3000 &
elif command -v firefox-esr > /dev/null; then 
    firefox-esr http://localhost:3000 &
else
    echo "Firefox not found. Please open http://localhost:3000 manually."
fi

# Clean up temp scripts
rm /tmp/backend_startup.sh /tmp/frontend_startup.sh

echo "Development environment started! Terminal windows have been minimized."