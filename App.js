import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { firebaseConfig, appId } from './firebase-config';

// Main App component
const App = () => {
    // State variables for Firebase instances, user ID, and tasks
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

    // State for LLM-powered suggestions
    const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
    const [currentSuggestions, setCurrentSuggestions] = useState([]);
    const [suggestionLoading, setSuggestionLoading] = useState(false);
    const [taskForSuggestions, setTaskForSuggestions] = useState(null);
    const [suggestionError, setSuggestionError] = useState(null);

    // State for authentication UI
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [authLoading, setAuthLoading] = useState(false);

    // State for view navigation
    const [currentView, setCurrentView] = useState('tasks');

    // State for calendar view
    const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date());
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // State for meal plan
    const [mealPlan, setMealPlan] = useState({});
    const [mealItems, setMealItems] = useState([]);

    // State for devotional
    const [currentDevotionalDate, setCurrentDevotionalDate] = useState(new Date());
    const [dailyDevotionalThoughts, setDailyDevotionalThoughts] = useState({});
    const [dailyVerse, setDailyVerse] = useState({ text: '', reference: '' });
    const [verseLoading, setVerseLoading] = useState(false);
    const [verseError, setVerseError] = useState(null);

    // State for Health & Fitness
    const [exerciseText, setExerciseText] = useState('');
    const [weightValue, setWeightValue] = useState('');
    const [stepsCount, setStepsCount] = useState('');
    const [sleepHours, setSleepHours] = useState('');
    const [healthMetrics, setHealthMetrics] = useState([]);

    // State for Family Goals
    const [familyGoals, setFamilyGoals] = useState([]);
    const [newGoalTitle, setNewGoalTitle] = useState('');

    // State for Event Planning
    const [events, setEvents] = useState([]);
    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventDate, setNewEventDate] = useState('');

    // State for Lists
    const [lists, setLists] = useState([]);
    const [newListTitle, setNewListTitle] = useState('');
    const [shoppingListItems, setShoppingListItems] = useState([]);

    // State for Family Budget
    const [transactions, setTransactions] = useState([]);
    const [transactionType, setTransactionType] = useState('expense');
    const [transactionAmount, setTransactionAmount] = useState('');
    const [transactionCategory, setTransactionCategory] = useState('');
    const [transactionDescription, setTransactionDescription] = useState('');
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);

    // Recurring Finance States
    const [recurringIncome, setRecurringIncome] = useState(0);
    const [incomeFrequency, setIncomeFrequency] = useState('weekly');
    const [bills, setBills] = useState([]);
    const [newBillName, setNewBillName] = useState('');
    const [newBillAmount, setNewBillAmount] = useState('');
    const [newBillDueDate, setNewBillDueDate] = useState('');
    const [newBillFrequency, setNewBillFrequency] = useState('monthly');
    const [calculationPeriod, setCalculationPeriod] = useState('weekly');

    // Predefined categories for budgeting
    const expenseCategories = ["Groceries", "Utilities", "Rent/Mortgage", "Transportation", "Entertainment", "Dining Out", "Shopping", "Healthcare", "Education", "Other"];
    const incomeCategories = ["Salary", "Freelance", "Investment", "Gift", "Other"];

    // State for Family Communication Hub
    const [messages, setMessages] = useState([]);
    const [newMessageText, setNewMessageText] = useState('');

    // Refs for input fields
    const newTaskTextInputRef = useRef(null);

    // Effect for initializing Firebase and handling authentication
    useEffect(() => {
        try {
            // Only initialize Firebase if firebaseConfig is not empty
            if (Object.keys(firebaseConfig).length > 0 && firebaseConfig.apiKey !== "YOUR_API_KEY") {
                const app = initializeApp(firebaseConfig);
                const firestore = getFirestore(app);
                const firebaseAuth = getAuth(app);

                setDb(firestore);
                setAuth(firebaseAuth);

                // Listen for authentication state changes
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

    // All your existing useEffect hooks for data fetching...
    // (I'll include the essential ones, but you can copy all of them from your original code)

    // Effect for fetching and listening to private tasks
    useEffect(() => {
        if (!db || !userId || !isAuthReady) {
            return;
        }

        const privateTasksCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/privateTasks`);
        const unsubscribe = onSnapshot(privateTasksCollectionRef, (snapshot) => {
            const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPrivateTasks(tasks.sort((a, b) => a.createdAt - b.createdAt));
        }, (error) => {
            console.error("Error listening to private tasks:", error);
        });

        return () => unsubscribe();
    }, [db, userId, isAuthReady]);

    // Effect for fetching and listening to shared tasks
    useEffect(() => {
        if (!db || !isAuthReady) {
            return;
        }

        const sharedTasksCollectionRef = collection(db, `artifacts/${appId}/public/data/sharedTasks`);
        const unsubscribe = onSnapshot(sharedTasksCollectionRef, (snapshot) => {
            const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSharedTasks(tasks.sort((a, b) => a.createdAt - b.createdAt));
        }, (error) => {
            console.error("Error listening to shared tasks:", error);
        });

        return () => unsubscribe();
    }, [db, isAuthReady]);

    // Add all your other useEffect hooks here...
    // (Copy them from your original code)

    // Function to fetch a random Bible verse and save it to Firestore
    const fetchAndSaveDailyVerse = async (dateString) => {
        setVerseLoading(true);
        setVerseError(null);
        try {
            const response = await fetch('https://bible-api.com/?random=verse');
            const data = await response.json();

            if (data.text && data.reference) {
                const verseText = data.text.replace(/\n/g, ' ').trim();
                const verseReference = data.reference;

                const devotionalDocRef = doc(db, `artifacts/${appId}/public/data/dailyDevotionals`, dateString);
                await setDoc(devotionalDocRef, {
                    devotionalText: verseText,
                    devotionalReference: verseReference,
                    createdAt: Date.now()
                }, { merge: true });

                setDailyVerse({ text: verseText, reference: verseReference });
            } else {
                setVerseError("Could not fetch a Bible verse. Please try again.");
                setDailyVerse({ text: 'Failed to load verse.', reference: '' });
            }
        } catch (error) {
            console.error("Error fetching Bible verse:", error);
            setVerseError("Error fetching Bible verse. Check console for details.");
            setDailyVerse({ text: 'Failed to load verse.', reference: '' });
        } finally {
            setVerseLoading(false);
        }
    };

    // Add all your other functions here...
    // (Copy them from your original code)

    // Function to add a new task
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

    // Add all your other functions here...
    // (I'll include a few key ones as examples)

    // Function to handle task completion toggle
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

    // Function to confirm completion with comment
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

    // Function to update a task in Firestore
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

    // Function to delete a task
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

    // Function to get task suggestions (note: this will need your Gemini API key)
    const getTaskSuggestions = async (taskText) => {
        setSuggestionLoading(true);
        setTaskForSuggestions(taskText);
        setCurrentSuggestions([]);
        setSuggestionError(null);

        // You'll need to add your Gemini API key here
        const apiKey = process.env.REACT_APP_GEMINI_API_KEY || "";
        
        if (!apiKey) {
            setSuggestionError("Gemini API key not configured. Please set REACT_APP_GEMINI_API_KEY environment variable.");
            setSuggestionLoading(false);
            setShowSuggestionsModal(true);
            return;
        }

        const chatHistory = [];
        chatHistory.push({ role: "user", parts: [{ text: `Given the task "${taskText}", break it down into a list of smaller, actionable sub-tasks. Provide only the list of sub-tasks.` }] });

        const payload = {
            contents: chatHistory,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "ARRAY",
                    items: {
                        type: "STRING"
                    }
                }
            }
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const json = result.candidates[0].content.parts[0].text;
                const parsedJson = JSON.parse(json);
                if (Array.isArray(parsedJson) && parsedJson.length > 0) {
                    setCurrentSuggestions(parsedJson);
                } else {
                    setSuggestionError("No specific sub-tasks could be generated for this task.");
                }
            } else {
                setSuggestionError("Failed to get suggestions. Please try again.");
            }
        } catch (error) {
            console.error("Error calling Gemini API:", error);
            setSuggestionError("Error fetching suggestions. Check console for details.");
        } finally {
            setSuggestionLoading(false);
            setShowSuggestionsModal(true);
        }
    };

    // Function to add a suggested sub-task
    const addSuggestedTask = (suggestionText, isShared) => {
        addTask(suggestionText, isShared, null);
    };

    // Authentication Functions
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
            // Clear all other state...
        } catch (error) {
            console.error("Error logging out:", error);
            setAuthError(error.message);
        } finally {
            setAuthLoading(false);
        }
    };

    // Component for displaying a single task item
    const TaskItem = ({ task, isShared, onToggle, onDelete, onGetSuggestions }) => {
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
                <div className="flex flex-col sm:flex-row items-center gap-2 flex-shrink-0 ml-0 sm:ml-4">
                    <button
                        onClick={() => onGetSuggestions(task.text)}
                        className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-sm font-semibold hover:bg-blue-200 transition duration-150 ease-in-out flex items-center"
                        disabled={suggestionLoading && taskForSuggestions === task.text}
                    >
                        {suggestionLoading && taskForSuggestions === task.text ? (
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <span className="mr-1">✨</span>
                    </>
                )}
            </div>
        </div>
    );
};

export default App;
                        Break Down
                    </button>
                    <button
                        onClick={() => onDelete(task.id, isShared)}
                        className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition duration-150 ease-in-out"
                        aria-label="Delete task"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
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

    // Add all your other components here (CustomCalendar, CalendarView, etc.)
    // For brevity, I'm showing the main structure. Copy all components from your original code.

    // Render loading state or authentication form if not ready/logged in
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

                {/* Authentication Section */}
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
                        {/* User ID Display and Logout */}
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

                        {/* Navigation Tabs */}
                        <div className="flex justify-center mb-8 gap-4 flex-wrap">
                            <button
                                onClick={() => setCurrentView('tasks')}
                                className={`px-6 py-3 rounded-lg font-semibold transition duration-150 ease-in-out ${currentView === 'tasks' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                            >
                                Tasks
                            </button>
                            {/* Add other navigation buttons as needed */}
                        </div>

                        {/* Conditional Rendering of Views */}
                        {currentView === 'tasks' && (
                            <>
                                {/* Add New Task Section */}
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

                                {/* Task Lists Section */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Private Tasks */}
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
                                                        onGetSuggestions={getTaskSuggestions}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Shared Tasks */}
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
                                                        onGetSuggestions={getTaskSuggestions}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Comment Modal */}
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

                        {/* Suggestions Modal */}
                        {showSuggestionsModal && (
                            <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
                                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                                    <h3 className="text-xl font-bold text-gray-800 mb-4">Suggested Sub-tasks for "{taskForSuggestions}"</h3>
                                    {suggestionLoading ? (
                                        <div className="flex items-center justify-center py-4">
                                            <svg className="animate-spin h-8 w-8 text-indigo-500 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <p className="text-gray-600">Generating suggestions...</p>
                                        </div>
                                    ) : suggestionError ? (
                                        <p className="text-red-600 italic mb-4">{suggestionError}</p>
                                    ) : currentSuggestions.length > 0 ? (
                                        <ul className="list-disc pl-5 mb-4 space-y-2">
                                            {currentSuggestions.map((suggestion, index) => (
                                                <li key={index} className="text-gray-700">
                                                    {suggestion}
                                                    <div className="flex gap-2 mt-1">
                                                        <button
                                                            onClick={() => addSuggestedTask(suggestion, false)}
                                                            className="px-3 py-1 text-xs bg-indigo-100 text-indigo-600 rounded-full hover:bg-indigo-200"
                                                        >
                                                            Add to Private
                                                        </button>
                                                        <button
                                                            onClick={() => addSuggestedTask(suggestion, true)}
                                                            className="px-3 py-1 text-xs bg-purple-100 text-purple-600 rounded-full hover:bg-purple-200"
                                                        >
                                                            Add to Shared
                                                        </button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-gray-500 italic mb-4">No suggestions found.</p>
                                    )}
                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => setShowSuggestionsModal(false)}
                                            className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition duration-150 ease-in-out"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )} 