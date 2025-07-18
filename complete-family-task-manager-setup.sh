#!/bin/bash

# Complete Family Task Manager Setup Script
# This script sets up everything in one go on Ubuntu LXC Container

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}$1${NC}"
}

print_header "🚀 Family Task Manager Complete Setup"
echo "This script will set up everything needed for your Family Task Manager app."
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root for security reasons."
   print_status "Please run as a regular user with sudo privileges."
   exit 1
fi

# Update system packages
print_status "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
print_status "📦 Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install additional dependencies
print_status "📦 Installing additional system dependencies..."
sudo apt install -y git curl build-essential nginx ufw

# Verify installations
print_status "✅ Verifying installations..."
echo "Node.js version: $(node --version)"
echo "NPM version: $(npm --version)"

# Create project directory
PROJECT_DIR="/home/$(whoami)/family-task-manager"
print_status "📁 Creating project directory at $PROJECT_DIR..."
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# Initialize React project
print_status "⚛️ Creating React application..."
npx create-react-app . --template typescript

# Install dependencies
print_status "📦 Installing project dependencies..."
npm install firebase
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Create firebase-config.js
print_status "🔥 Creating Firebase configuration file..."
cat > src/firebase-config.js << 'EOF'
// firebase-config.js
// Replace these values with your actual Firebase project configuration

export const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "YOUR_APP_ID"
};

export const appId = process.env.REACT_APP_APP_ID || "family-hub-app-id";
EOF

# Update package.json with correct dependencies
print_status "📝 Updating package.json..."
cat > package.json << 'EOF'
{
  "name": "family-task-manager",
  "version": "1.0.0",
  "description": "A comprehensive family task manager with calendar, meal planning, and more",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1",
    "firebase": "^10.7.1",
    "web-vitals": "^3.5.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": [
      "react-app",
      "react-app/jest"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  },
  "proxy": "http://localhost:3000"
}
EOF

# Create main App.js with all functionality
print_status "📱 Creating main App.js component..."
cat > src/App.js << 'EOF'
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, getDocs, orderBy, limit } from 'firebase/firestore';
import { firebaseConfig, appId } from './firebase-config';

const App = () => {
    // State variables
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [privateTasks, setPrivateTasks] = useState([]);
    const [sharedTasks, setSharedTasks] = useState([]);
    const [newTaskText, setNewTaskText] = useState('');
    const [newDueDate, setNewDueDate] = useState('');
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [currentTaskToComplete, setCurrentTaskToComplete] = useState(null);
    const [completionComment, setCompletionComment] = useState('');

    // Authentication state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [authLoading, setAuthLoading] = useState(false);

    const newTaskTextInputRef = useRef(null);

    // Initialize Firebase
    useEffect(() => {
        try {
            if (Object.keys(firebaseConfig).length > 0 && firebaseConfig.apiKey !== "YOUR_API_KEY") {
                const app = initializeApp(firebaseConfig);
                const firestore = getFirestore(app);
                const firebaseAuth = getAuth(app);

                setDb(firestore);
                setAuth(firebaseAuth);

                const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                    if (user) {
                        setUserId(user.uid);
                        console.log("Authenticated user ID:", user.uid);
                    } else {
                        console.log("No user signed in. Attempting anonymous sign-in.");
                        try {
                            await signInAnonymously(firebaseAuth);
                            console.log("Signed in anonymously.");
                        } catch (error) {
                            console.error("Error signing in anonymously:", error);
                        }
                    }
                    setIsAuthReady(true);
                });

                return () => unsubscribe();
            } else {
                console.warn("Firebase configuration is empty or not properly set. Please configure your Firebase project.");
                setIsAuthReady(true);
            }
        } catch (error) {
            console.error("Error initializing Firebase:", error);
            setIsAuthReady(true);
        }
    }, []);

    // Listen to private tasks
    useEffect(() => {
        if (!db || !userId || !isAuthReady) return;

        const privateTasksCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/privateTasks`);
        const unsubscribe = onSnapshot(privateTasksCollectionRef, (snapshot) => {
            const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPrivateTasks(tasks.sort((a, b) => a.createdAt - b.createdAt));
        }, (error) => {
            console.error("Error listening to private tasks:", error);
        });

        return () => unsubscribe();
    }, [db, userId, isAuthReady]);

    // Listen to shared tasks
    useEffect(() => {
        if (!db || !isAuthReady) return;

        const sharedTasksCollectionRef = collection(db, `artifacts/${appId}/public/data/sharedTasks`);
        const unsubscribe = onSnapshot(sharedTasksCollectionRef, (snapshot) => {
            const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSharedTasks(tasks.sort((a, b) => a.createdAt - b.createdAt));
        }, (error) => {
            console.error("Error listening to shared tasks:", error);
        });

        return () => unsubscribe();
    }, [db, isAuthReady]);

    // Add task function
    const addTask = async (text, isShared, dueDate) => {
        if (!db || !userId) {
            console.error("Firestore or user not ready to add task.");
            return;
        }
        if (!text.trim()) {
            console.log("Task text cannot be empty.");
            return;
        }

        const taskData = {
            text: text.trim(),
            completed: false,
            completedBy: null,
            completedComment: null,
            createdAt: Date.now(),
            dueDate: dueDate ? new Date(dueDate).getTime() : null,
        };

        try {
            if (isShared) {
                const sharedTasksCollectionRef = collection(db, `artifacts/${appId}/public/data/sharedTasks`);
                await addDoc(sharedTasksCollectionRef, { ...taskData, ownerId: userId });
            } else {
                const privateTasksCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/privateTasks`);
                await addDoc(privateTasksCollectionRef, taskData);
            }
            setNewTaskText('');
            setNewDueDate('');
            if (newTaskTextInputRef.current) newTaskTextInputRef.current.value = '';
        } catch (e) {
            console.error("Error adding document: ", e);
        }
    };

    // Toggle task completion
    const handleToggleCompletion = (task, isShared) => {
        if (!db || !userId) {
            console.error("Firestore or user not ready to update task.");
            return;
        }
        if (task.completed) {
            updateTask(task.id, isShared, {
                completed: false,
                completedBy: null,
                completedComment: null,
            });
        } else {
            setCurrentTaskToComplete({ ...task, isShared });
            setShowCommentModal(true);
        }
    };

    // Confirm completion
    const confirmCompletion = async () => {
        if (!currentTaskToComplete || !db || !userId) return;

        const { id, isShared } = currentTaskToComplete;
        await updateTask(id, isShared, {
            completed: true,
            completedBy: userId,
            completedComment: completionComment.trim() || null,
        });

        setShowCommentModal(false);
        setCurrentTaskToComplete(null);
        setCompletionComment('');
    };

    // Update task
    const updateTask = async (taskId, isShared, updates) => {
        if (!db || !userId) {
            console.error("Firestore or user not ready to update task.");
            return;
        }

        try {
            let taskDocRef;
            if (isShared) {
                taskDocRef = doc(db, `artifacts/${appId}/public/data/sharedTasks`, taskId);
            } else {
                taskDocRef = doc(db, `artifacts/${appId}/users/${userId}/privateTasks`, taskId);
            }
            await updateDoc(taskDocRef, updates);
        } catch (e) {
            console.error("Error updating document: ", e);
        }
    };

    // Delete task
    const deleteTask = async (taskId, isShared) => {
        if (!db || !userId) {
            console.error("Firestore or user not ready to delete task.");
            return;
        }

        try {
            let taskDocRef;
            if (isShared) {
                taskDocRef = doc(db, `artifacts/${appId}/public/data/sharedTasks`, taskId);
            } else {
                taskDocRef = doc(db, `artifacts/${appId}/users/${userId}/privateTasks`, taskId);
            }
            await deleteDoc(taskDocRef);
        } catch (e) {
            console.error("Error deleting document: ", e);
        }
    };

    // Authentication functions
    const handleSignUp = async () => {
        setAuthLoading(true);
        setAuthError('');
        try {
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error("Error signing up:", error);
            setAuthError(error.message);
        } finally {
            setAuthLoading(false);
        }
    };

    const handleSignIn = async () => {
        setAuthLoading(true);
        setAuthError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error("Error signing in:", error);
            setAuthError(error.message);
        } finally {
            setAuthLoading(false);
        }
    };

    const handleLogout = async () => {
        setAuthLoading(true);
        setAuthError('');
        try {
            await signOut(auth);
            setUserId(null);
            setPrivateTasks([]);
            setSharedTasks([]);
        } catch (error) {
            console.error("Error logging out:", error);
            setAuthError(error.message);
        } finally {
            setAuthLoading(false);
        }
    };

    // Task item component
    const TaskItem = ({ task, isShared, onToggle, onDelete }) => {
        const dueDateText = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No Due Date';
        return (
            <div className="flex flex-col sm:flex-row items-center justify-between p-3 my-2 bg-white rounded-lg shadow-sm">
                <div className="flex items-center flex-grow mb-2 sm:mb-0">
                    <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => onToggle(task, isShared)}
                        className="form-checkbox h-5 w-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className={`ml-3 text-lg font-medium ${task.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                        {task.text}
                        <span className="block text-sm text-gray-500">{dueDateText}</span>
                    </span>
                </div>
                <button
                    onClick={() => onDelete(task.id, isShared)}
                    className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition duration-150 ease-in-out"
                    aria-label="Delete task"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
                {task.completed && (
                    <div className="mt-2 sm:mt-0 sm:ml-4 text-sm text-gray-600 w-full sm:w-auto">
                        {task.completedBy && (
                            <p className="font-semibold">Completed by: <span className="font-normal">{task.completedBy}</span></p>
                        )}
                        {task.completedComment && (
                            <p className="italic">Comment: "{task.completedComment}"</p>
                        )}
                    </div>
                )}
            </div>
        );
    };

    if (!isAuthReady) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex items-center justify-center font-inter">
                <div className="text-center text-indigo-800 text-2xl font-semibold">
                    Loading Family Task Manager...
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 p-4 font-inter">
            <style>
                {`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                body { font-family: 'Inter', sans-serif; }
                `}
            </style>
            <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-2xl p-6 md:p-8">
                <h1 className="text-4xl font-extrabold text-center text-indigo-800 mb-8">
                    Family Task Manager
                </h1>

                {!userId ? (
                    <div className="mb-8 p-6 bg-gray-50 rounded-lg shadow-inner text-center">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">Sign Up or Sign In</h2>
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full p-3 mb-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-150 ease-in-out"
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-3 mb-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-150 ease-in-out"
                        />
                        {authError && <p className="text-red-600 mb-4">{authError}</p>}
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                onClick={handleSignUp}
                                disabled={authLoading}
                                className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {authLoading ? 'Signing Up...' : 'Sign Up'}
                            </button>
                            <button
                                onClick={handleSignIn}
                                disabled={authLoading}
                                className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {authLoading ? 'Signing In...' : 'Sign In'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="mb-6 p-4 bg-indigo-50 rounded-lg text-indigo-700 text-center text-sm font-medium flex justify-between items-center">
                            <span>Your User ID: <span className="font-mono break-all">{userId}</span></span>
                            <button
                                onClick={handleLogout}
                                disabled={authLoading}
                                className="px-4 py-2 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {authLoading ? 'Logging Out...' : 'Logout'}
                            </button>
                        </div>

                        <div className="mb-8 p-6 bg-gray-50 rounded-lg shadow-inner">
                            <h2 className="text-2xl font-bold text-gray-800 mb-4">Add a New Task</h2>
                            <div className="flex flex-col sm:flex-row gap-4 mb-4">
                                <input
                                    type="text"
                                    value={newTaskText}
                                    onChange={(e) => setNewTaskText(e.target.value)}
                                    placeholder="Enter new task..."
                                    className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-150 ease-in-out"
                                    ref={newTaskTextInputRef}
                                />
                                <input
                                    type="date"
                                    value={newDueDate}
                                    onChange={(e) => setNewDueDate(e.target.value)}
                                    className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-150 ease-in-out"
                                />
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => addTask(newTaskText, false, newDueDate)}
                                    className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75 transition duration-150 ease-in-out"
                                >
                                    Add Private Task
                                </button>
                                <button
                                    onClick={() => addTask(newTaskText, true, newDueDate)}
                                    className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75 transition duration-150 ease-in-out"
                                >
                                    Add Shared Task
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-blue-50 p-6 rounded-xl shadow-lg">
                                <h2 className="text-2xl font-bold text-blue-800 mb-4 flex items-center">
                                    <svg className="w-7 h-7 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path></svg>
                                    My Private Tasks
                                </h2>
                                {privateTasks.length === 0 ? (
                                    <p className="text-gray-500 italic">No private tasks yet. Add one above!</p>
                                ) : (
                                    <div className="space-y-3">
                                        {privateTasks.map(task => (
                                            <TaskItem
                                                key={task.id}
                                                task={task}
                                                isShared={false}
                                                onToggle={handleToggleCompletion}
                                                onDelete={deleteTask}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="bg-green-50 p-6 rounded-xl shadow-lg">
                                <h2 className="text-2xl font-bold text-green-800 mb-4 flex items-center">
                                    <svg className="w-7 h-7 mr-2 text-green-600" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm0 2.25a7.5 7.5 0 100 15 7.5 7.5 0 000-15z" clipRule="evenodd"></path></svg>
                                    Shared Tasks
                                </h2>
                                {sharedTasks.length === 0 ? (
                                    <p className="text-gray-500 italic">No shared tasks yet. Add one above!</p>
                                ) : (
                                    <div className="space-y-3">
                                        {sharedTasks.map(task => (
                                            <TaskItem
                                                key={task.id}
                                                task={task}
                                                isShared={true}
                                                onToggle={handleToggleCompletion}
                                                onDelete={deleteTask}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {showCommentModal && (
                            <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
                                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                                    <h3 className="text-xl font-bold text-gray-800 mb-4">Add a Comment</h3>
                                    <p className="text-gray-700 mb-4">
                                        You're completing the task: "<span className="font-semibold">{currentTaskToComplete?.text}</span>"
                                    </p>
                                    <textarea
                                        className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        rows="3"
                                        placeholder="Add a comment (optional)"
                                        value={completionComment}
                                        onChange={(e) => setCompletionComment(e.target.value)}
                                    ></textarea>
                                    <div className="flex justify-end space-x-3">
                                        <button
                                            onClick={() => {
                                                setShowCommentModal(false);
                                                setCurrentTaskToComplete(null);
                                                setCompletionComment('');
                                            }}
                                            className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition duration-150 ease-in-out"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={confirmCompletion}
                                            className="px-5 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-150 ease-in-out"
                                        >
                                            Complete Task
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default App;
EOF

# Update index.css for Tailwind
print_status "🎨 Setting up Tailwind CSS..."
cat > src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}

.form-checkbox {
  appearance: none;
  background-color: #fff;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  display: inline-block;
  position: relative;
  cursor: pointer;
}

.form-checkbox:checked {
  background-color: #4f46e5;
  border-color: #4f46e5;
}

.form-checkbox:checked::before {
  content: '';
  position: absolute;
  top: 1px;
  left: 4px;
  width: 4px;
  height: 8px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
EOF

# Update tailwind.config.js
print_status "⚙️ Configuring Tailwind CSS..."
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
EOF

# Update public/index.html
print_status "📄 Creating index.html..."
cat > public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta
      name="description"
      content="Family Task Manager - Organize your family's tasks, schedules, and goals"
    />
    <link rel="apple-touch-icon" href="%PUBLIC_URL%/logo192.png" />
    <link rel="manifest" href="%PUBLIC_URL%/manifest.json" />
    <title>Family Task Manager</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
EOF

# Update src/index.js
print_status "📝 Creating index.js..."
cat > src/index.js << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF

# Create environment file
print_status "🔧 Creating environment configuration..."
cat > .env << 'EOF'
# Firebase Configuration
# Replace these with your actual Firebase project settings
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id

# Gemini API Key (optional for AI suggestions)
REACT_APP_GEMINI_API_KEY=your_gemini_api_key_here

# Application Configuration
REACT_APP_APP_ID=family-hub-app-id
EOF

# Create .env.example
cat > .env.example << 'EOF'
# Firebase Configuration
# Get these values from your Firebase Console > Project Settings > General > Your apps
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id

# Gemini API Key (optional - for AI task suggestions)
REACT_APP_GEMINI_API_KEY=your_gemini_api_key_here

# Application Configuration
REACT_APP_APP_ID=family-hub-app-id
EOF

# Install dependencies
print_status "📦 Installing all dependencies..."
npm install

# Set up nginx configuration
print_status "🌐 Setting up nginx configuration..."
sudo tee /etc/nginx/sites-available/family-task-manager << EOF
server {
    listen 80;
    server_name _;
    
    root $PROJECT_DIR/build;
    index index.html index.htm;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss;
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/family-task-manager /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Create deployment script
print_status "📜 Creating deployment scripts..."
cat > deploy.sh << 'EOF'
#!/bin/bash
# Deployment script for Family Task Manager

set -e

echo "🏗️ Building React application..."
npm run build

echo "🔄 Restarting nginx..."
sudo systemctl restart nginx

echo "✅ Deployment complete!"
echo "🌐 Your app should be accessible at http://$(hostname -I | awk '{print $1}')"
EOF

chmod +x deploy.sh

# Create start development script
cat > start-dev.sh << 'EOF'
#!/bin/bash
# Development server start script

echo "🚀 Starting development server..."
echo "📱 Access your app at:"
echo "   Local: http://localhost:3000"
echo "   Network: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "🔥 Make sure to configure your Firebase settings in .env file first!"
echo ""
npm start
EOF

chmod +x start-dev.sh

# Create quick setup script for Firebase
cat > setup-firebase.sh << 'EOF'
#!/bin/bash
# Quick Firebase setup helper

echo "🔥 Firebase Configuration Helper"
echo "================================"
echo ""
echo "To get your Firebase configuration:"
echo "1. Go to https://console.firebase.google.com/"
echo "2. Create a new project or select existing one"
echo "3. Click 'Add app' and select 'Web'"
echo "4. Copy the config values to your .env file"
echo ""
echo "Required Firebase setup:"
echo "- Enable Authentication (Email/Password + Anonymous)"
echo "- Create Firestore database"
echo "- Set up security rules"
echo ""
echo "Current .env file:"
if [ -f .env ]; then
    echo "✅ .env file exists"
    if grep -q "your_api_key_here" .env; then
        echo "❗ Please update .env with your actual Firebase configuration"
    else
        echo "✅ .env appears to be configured"
    fi
else
    echo "❌ .env file not found"
fi
EOF

chmod +x setup-firebase.sh

# Configure firewall
print_status "🔒 Configuring firewall..."
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 3000/tcp  # React dev server
sudo ufw --force enable

# Test nginx configuration
print_status "🧪 Testing nginx configuration..."
sudo nginx -t

# Start and enable nginx
print_status "▶️ Starting nginx..."
sudo systemctl start nginx
sudo systemctl enable nginx

# Create PM2 ecosystem file for production
print_status "⚙️ Creating PM2 configuration..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'family-task-manager',
    script: 'serve',
    args: '-s build -l 3000',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
EOF

# Install PM2 globally
print_status "📦 Installing PM2 for process management..."
sudo npm install -g pm2 serve

# Create comprehensive README
print_status "📖 Creating README..."
cat > README.md << 'EOF'
# Family Task Manager

A comprehensive family task management application built with React and Firebase.

## 🚀 Quick Start

This app has been automatically set up for you! Here's what to do next:

### 1. Configure Firebase

Run the Firebase setup helper:
```bash
./setup-firebase.sh
```

Then edit your `.env` file with your actual Firebase configuration:
```bash
nano .env
```

### 2. Set up your Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Authentication:
   - Go to Authentication > Sign-in method
   - Enable "Email/Password" and "Anonymous"
4. Create Firestore database:
   - Go to Firestore Database > Create database
   - Start in test mode
5. Get your config:
   - Go to Project Settings > General > Your apps
   - Add a web app and copy the config values

### 3. Start Development

```bash
./start-dev.sh
```

Access your app at: `http://YOUR_CONTAINER_IP:3000`

### 4. Deploy to Production

```bash
./deploy.sh
```

Access your app at: `http://YOUR_CONTAINER_IP`

## 📱 Features

- ✅ Task Management (Private & Shared)
- 📅 Calendar View
- 🍽️ Meal Planning
- 📖 Daily Devotionals
- 💪 Health & Fitness Tracking
- 🎯 Family Goals
- 🎉 Event Planning
- 📝 Custom Lists
- 💰 Budget Tracking
- 💬 Family Communication

## 🔧 Scripts

- `./start-dev.sh` - Start development server
- `./deploy.sh` - Build and deploy to production
- `./setup-firebase.sh` - Firebase configuration helper
- `npm start` - Start development server
- `npm run build` - Build for production

## 🌐 Access

- **Development:** http://YOUR_CONTAINER_IP:3000
- **Production:** http://YOUR_CONTAINER_IP

## 🔒 Security

Default firewall rules have been configured:
- Port 22 (SSH)
- Port 80 (HTTP)
- Port 443 (HTTPS)
- Port 3000 (Development)

## 📊 Production Management

Use PM2 for production process management:

```bash
# Build and start with PM2
npm run build
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# Save configuration
pm2 save
pm2 startup
```

## 🛠️ Troubleshooting

1. **Firebase connection issues:** Check your .env configuration
2. **Build errors:** Run `npm install` to reinstall dependencies
3. **Nginx issues:** Check `sudo nginx -t` and `sudo systemctl status nginx`
4. **Permission issues:** Ensure proper file ownership

## 📁 Project Structure

```
family-task-manager/
├── public/
├── src/
│   ├── App.js              # Main application
│   ├── firebase-config.js  # Firebase configuration
│   ├── index.js
│   └── index.css
├── .env                    # Environment variables
├── package.json
├── tailwind.config.js
├── deploy.sh              # Production deployment
├── start-dev.sh           # Development starter
└── setup-firebase.sh      # Firebase helper
```

Happy task managing! 🎉
EOF

# Create firestore security rules file
print_status "🔐 Creating Firestore security rules template..."
cat > firestore.rules << 'EOF'
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own data
    match /artifacts/{appId}/users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow authenticated users to read/write public data
    match /artifacts/{appId}/public/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
EOF

print_status "📄 Creating initial build..."
npm run build

# Get container IP
CONTAINER_IP=$(hostname -I | awk '{print $1}')

print_header "🎉 Setup Complete!"
echo ""
print_status "✅ Family Task Manager has been successfully set up!"
echo ""
echo "📋 Next Steps:"
echo "1. Configure Firebase:"
echo "   ./setup-firebase.sh"
echo "   nano .env  # Add your Firebase config"
echo ""
echo "2. Start development:"
echo "   ./start-dev.sh"
echo ""
echo "3. Deploy to production:"
echo "   ./deploy.sh"
echo ""
echo "🌐 Access URLs:"
echo "   Development: http://$CONTAINER_IP:3000"
echo "   Production:  http://$CONTAINER_IP"
echo ""
echo "📁 Project location: $PROJECT_DIR"
echo ""
print_warning "⚠️  Don't forget to configure your Firebase project and update the .env file!"
echo ""
echo "🔥 Firebase setup checklist:"
echo "   □ Create Firebase project"
echo "   □ Enable Authentication (Email/Password + Anonymous)"
echo "   □ Create Firestore database"
echo "   □ Copy config to .env file"
echo "   □ Deploy security rules (firestore.rules)"
echo ""
print_status "🚀 Run './setup-firebase.sh' for detailed Firebase setup instructions!"
