import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

// Define global variables for Firebase configuration and app ID
// These are provided by the Canvas environment. For self-hosting, provide defaults.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'family-hub-app';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyD6X_k7LAr0f0cNOIcNKlVdPhK6h3bKffg",
  authDomain: "familyhub-b4ad8.firebaseapp.com",
  projectId: "familyhub-b4ad8",
  storageBucket: "familyhub-b4ad8.firebasestorage.app",
  messagingSenderId: "286600354710",
  appId: "1:286600354710:web:94e77e2ff9e1fe5505dbb7",
  measurementId: "G-QQ4LDT4QGK"
};


// Main App component
const App = () => {
    // State variables for Firebase instances, user ID, and tasks
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [privateTasks, setPrivateTasks] = useState([]);
    const [sharedTasks, setSharedTasks] = useState([]); // Corrected typo: setSharedToasks -> setSharedTasks
    const [newTaskText, setNewTaskText] = useState('');
    const [newDueDate, setNewDueDate] = useState(''); // New state for due date
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [currentTaskToComplete, setCurrentTaskToComplete] = useState(null);
    const [completionComment, setCompletionComment] = useState('');

    // State for LLM-powered suggestions
    const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
    const [currentSuggestions, setCurrentSuggestions] = useState([]);
    const [suggestionLoading, setSuggestionLoading] = useState(false);
    const [taskForSuggestions, setTaskForSuggestions] = useState(null); // To store the text of the task for which suggestions are being generated
    const [suggestionError, setSuggestionError] = useState(null); // To store any error messages from LLM call

    // State for authentication UI
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [authLoading, setAuthLoading] = useState(false);

    // State for view navigation ('tasks', 'calendar', 'mealPlan', 'devotional', 'healthFitness', 'familyGoals', 'eventPlanning', 'lists', 'budget', or 'communicationHub')
    const [currentView, setCurrentView] = useState('tasks');

    // State for calendar view
    const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date());
    const [currentMonth, setCurrentMonth] = useState(new Date()); // For custom calendar navigation

    // State for meal plan
    const [mealPlan, setMealPlan] = useState({}); // Stores the entire week's meal plan
    const [mealItems, setMealItems] = useState([]); // Stores all available meal items

    // State for devotional
    const [currentDevotionalDate, setCurrentDevotionalDate] = useState(new Date());
    const [dailyDevotionalThoughts, setDailyDevotionalThoughts] = useState({}); // Stores thoughts for the current day
    const [dailyVerse, setDailyVerse] = useState({ text: '', reference: '' });
    const [verseLoading, setVerseLoading] = useState(false);
    const [verseError, setVerseError] = useState(null);

    // State for Health & Fitness
    const [exerciseText, setExerciseText] = useState('');
    const [weightValue, setWeightValue] = useState('');
    const [stepsCount, setStepsCount] = useState('');
    const [sleepHours, setSleepHours] = useState('');
    const [healthMetrics, setHealthMetrics] = useState([]); // All health metrics for the user

    // State for Family Goals
    const [familyGoals, setFamilyGoals] = useState([]); // Stores top-level goals
    const [newGoalTitle, setNewGoalTitle] = useState('');

    // State for Event Planning
    const [events, setEvents] = useState([]); // Stores events
    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventDate, setNewEventDate] = '';

    // State for Lists
    const [lists, setLists] = useState([]); // Stores main lists
    const [newListTitle, setNewListTitle] = useState('');
    const [shoppingListItems, setShoppingListItems] = useState([]); // Stores shopping list items

    // State for Family Budget
    const [transactions, setTransactions] = useState([]);
    const [transactionType, setTransactionType] = useState('expense'); // 'income' or 'expense'
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
    const [newBillDueDate, setNewBillDueDate] = useState(''); // Day of month or day of week
    const [newBillFrequency, setNewBillFrequency] = useState('monthly');
    const [calculationPeriod, setCalculationPeriod] = useState('weekly'); // For calculating net balance

    // Predefined categories for budgeting
    const expenseCategories = ["Groceries", "Utilities", "Rent/Mortgage", "Transportation", "Entertainment", "Dining Out", "Shopping", "Healthcare", "Education", "Other"];
    const incomeCategories = ["Salary", "Freelance", "Investment", "Gift", "Other"];

    // State for Family Communication Hub
    const [messages, setMessages] = useState([]);
    const [newMessageText, setNewMessageText] = useState('');


    // Refs for input fields to clear them after adding a task
    const newTaskTextInputRef = useRef(null);

    // Effect for initializing Firebase and handling authentication
    useEffect(() => {
        try {
            // Only initialize Firebase if firebaseConfig is not empty
            if (Object.keys(firebaseConfig).length > 0) {
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
                        console.log("No user signed in. Attempting anonymous sign-in or custom token sign-in.");
                        if (initialAuthToken) {
                            try {
                                await signInWithCustomToken(firebaseAuth, initialAuthToken);
                                console.log("Signed in with custom token.");
                            } catch (error) {
                                console.error("Error signing in with custom token:", error);
                                try {
                                    await signInAnonymously(firebaseAuth);
                                    console.log("Signed in anonymously after custom token failure.");
                                } catch (anonError) {
                                    console.error("Error signing in anonymously:", anonError);
                                }
                            }
                        } else {
                            try {
                                await signInAnonymously(firebaseAuth);
                                console.log("Signed in anonymously.");
                            } catch (error) {
                                console.error("Error signing in anonymously:", error);
                            }
                        }
                    }
                    setIsAuthReady(true); // Mark authentication as ready
                });

                // Cleanup subscription on unmount
                return () => unsubscribe();
            } else {
                console.warn("Firebase configuration is empty. Firebase features will not be active.");
                setIsAuthReady(true); // Still mark auth ready so UI can load
            }
        } catch (error) {
            console.error("Error initializing Firebase:", error);
            setIsAuthReady(true); // Ensure auth is marked ready even if init fails to prevent infinite loading
        }
    }, []); // Empty dependency array ensures this runs only once on mount

    // Effect for fetching and listening to private tasks
    useEffect(() => {
        if (!db || !userId || !isAuthReady) {
            return;
        }

        const privateTasksCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/privateTasks`);
        const unsubscribe = onSnapshot(privateTasksCollectionRef, (snapshot) => {
            const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPrivateTasks(tasks.sort((a, b) => a.createdAt - b.createdAt)); // Sort by creation time
        }, (error) => {
            console.error("Error listening to private tasks:", error);
        });

        return () => unsubscribe(); // Cleanup listener
    }, [db, userId, isAuthReady]); // Re-run when db, userId, or isAuthReady changes

    // Effect for fetching and listening to shared tasks
    useEffect(() => {
        if (!db || !isAuthReady) {
            return;
        }

        const sharedTasksCollectionRef = collection(db, `artifacts/${appId}/public/data/sharedTasks`);
        const unsubscribe = onSnapshot(sharedTasksCollectionRef, (snapshot) => {
            const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSharedTasks(tasks.sort((a, b) => a.createdAt - b.createdAt)); // Sort by creation time
        }, (error) => {
            console.error("Error listening to shared tasks:", error);
        });

        return () => unsubscribe(); // Cleanup listener
    }, [db, isAuthReady]); // Re-run when db or isAuthReady changes

    // Effect for fetching and listening to meal plan
    useEffect(() => {
        if (!db || !userId || !isAuthReady) {
            return;
        }

        const mealPlanDocRef = doc(db, `artifacts/${appId}/users/${userId}/mealPlan/currentWeek`);
        const unsubscribe = onSnapshot(mealPlanDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setMealPlan(docSnap.data());
            } else {
                setMealPlan({}); // Initialize with empty object if no document exists
            }
        }, (error) => {
            console.error("Error listening to meal plan:", error);
        });

        return () => unsubscribe(); // Cleanup listener
    }, [db, userId, isAuthReady]); // Re-run when db, userId, or isAuthReady changes

    // Effect for fetching and listening to meal items
    useEffect(() => {
        if (!db || !userId || !isAuthReady) {
            return;
        }

        const mealItemsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/mealItems`);
        const unsubscribe = onSnapshot(mealItemsCollectionRef, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMealItems(items);
        }, (error) => {
            console.error("Error listening to meal items:", error);
        });

        return () => unsubscribe(); // Cleanup listener
    }, [db, userId, isAuthReady]); // Re-run when db, userId, or isAuthReady changes

    // Effect for fetching and listening to daily devotional thoughts and verse
    useEffect(() => {
        if (!db || !isAuthReady) {
            return;
        }

        const dateString = currentDevotionalDate.toISOString().split('T')[0]; // Format YYYY-MM-DD
        const devotionalDocRef = doc(db, `artifacts/${appId}/public/data/dailyDevotionals`, dateString);

        const unsubscribe = onSnapshot(devotionalDocRef, async (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setDailyDevotionalThoughts(data.thoughts || {});
                setDailyVerse({
                    text: data.devotionalText || '',
                    reference: data.devotionalReference || ''
                });
            } else {
                setDailyDevotionalThoughts({}); // No thoughts for this day yet
                // If no verse exists for this date, fetch a new one and save it
                await fetchAndSaveDailyVerse(dateString);
            }
        }, (error) => {
            console.error("Error listening to daily devotionals:", error);
        });

        return () => unsubscribe(); // Cleanup listener
    }, [db, isAuthReady, currentDevotionalDate]); // Re-run when db, isAuthReady, or currentDevotionalDate changes

    // Effect for fetching and listening to health metrics
    useEffect(() => {
        if (!db || !userId || !isAuthReady) {
            return;
        }

        const healthMetricsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/healthMetrics`);
        // Note: Firestore orderBy and limit can be used for performance, but for simplicity
        // and to avoid potential index issues, we'll fetch all and sort/limit in memory.
        const unsubscribe = onSnapshot(healthMetricsCollectionRef, (snapshot) => {
            const metrics = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setHealthMetrics(metrics.sort((a, b) => b.timestamp - a.timestamp)); // Sort by most recent first
        }, (error) => {
            console.error("Error listening to health metrics:", error);
        });

        return () => unsubscribe(); // Cleanup listener
    }, [db, userId, isAuthReady]); // Re-run when db, userId, or isAuthReady changes

    // Effect for fetching and listening to family goals
    useEffect(() => {
        if (!db || !userId || !isAuthReady) {
            return;
        }

        const goalsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/familyGoals`);
        const unsubscribe = onSnapshot(goalsCollectionRef, async (snapshot) => {
            const goalsWithSubtasks = await Promise.all(snapshot.docs.map(async (goalDoc) => {
                const goalData = { id: goalDoc.id, ...goalDoc.data() };
                const subTasksCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/familyGoals/${goalDoc.id}/subTasks`);
                const subTasksSnapshot = await getDocs(subTasksCollectionRef); // Fetch subtasks once
                const subTasks = subTasksSnapshot.docs.map(subTaskDoc => ({ id: subTaskDoc.id, ...subTaskDoc.data() }))
                                                    .sort((a, b) => a.createdAt - b.createdAt);
                return { ...goalData, subTasks };
            }));
            setFamilyGoals(goalsWithSubtasks.sort((a, b) => a.createdAt - b.createdAt));
        }, (error) => {
            console.error("Error listening to family goals:", error);
        });

        return () => unsubscribe(); // Cleanup listener
    }, [db, userId, isAuthReady]); // Re-run when db, userId, or isAuthReady changes

    // Effect for fetching and listening to events
    useEffect(() => {
        if (!db || !userId || !isAuthReady) {
            return;
        }

        const eventsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/events`);
        const unsubscribe = onSnapshot(eventsCollectionRef, (snapshot) => {
            const fetchedEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setEvents(fetchedEvents.sort((a, b) => a.createdAt - b.createdAt)); // Sort by creation time
        }, (error) => {
            console.error("Error listening to events:", error);
        });

        return () => unsubscribe();
    }, [db, userId, isAuthReady]);

    // Effect for fetching and listening to lists
    useEffect(() => {
        if (!db || !userId || !isAuthReady) {
            return;
        }

        const listsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/lists`);
        const unsubscribe = onSnapshot(listsCollectionRef, async (snapshot) => {
            const fetchedLists = await Promise.all(snapshot.docs.map(async (listDoc) => {
                const listData = { id: listDoc.id, ...listDoc.data() };
                const sectionsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/lists/${listDoc.id}/sections`);
                const sectionsSnapshot = await getDocs(sectionsCollectionRef); // Fetch sections once
                const sectionsWithItems = await Promise.all(sectionsSnapshot.docs.map(async (sectionDoc) => {
                    const sectionData = { id: sectionDoc.id, ...sectionDoc.data() };
                    const itemsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/lists/${listDoc.id}/sections/${sectionDoc.id}/items`);
                    const itemsSnapshot = await getDocs(itemsCollectionRef); // Fetch items once
                    const items = itemsSnapshot.docs.map(itemDoc => ({ id: itemDoc.id, ...itemDoc.data() }))
                                                    .sort((a, b) => a.createdAt - b.createdAt);
                    return { ...sectionData, items };
                }));
                return { ...listData, sections: sectionsWithItems.sort((a, b) => a.createdAt - b.createdAt) };
            }));
            setLists(fetchedLists.sort((a, b) => a.createdAt - b.createdAt));
        }, (error) => {
            console.error("Error listening to lists:", error);
        });

        return () => unsubscribe();
    }, [db, userId, isAuthReady]);

    // Effect for fetching and listening to shopping list items
    useEffect(() => {
        if (!db || !isAuthReady) {
            return;
        }

        const shoppingListCollectionRef = collection(db, `artifacts/${appId}/public/data/shoppingList`);
        const unsubscribe = onSnapshot(shoppingListCollectionRef, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setShoppingListItems(items.sort((a, b) => a.createdAt - b.createdAt));
        }, (error) => {
            console.error("Error listening to shopping list items:", error);
        });

        return () => unsubscribe();
    }, [db, isAuthReady]);

    // Effect for fetching and listening to financial transactions
    useEffect(() => {
        if (!db || !userId || !isAuthReady) {
            return;
        }

        const transactionsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/finances`);
        const unsubscribe = onSnapshot(transactionsCollectionRef, (snapshot) => {
            const fetchedTransactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTransactions(fetchedTransactions.sort((a, b) => b.date - a.date)); // Sort by most recent first
        }, (error) => {
            console.error("Error listening to transactions:", error);
        });

        return () => unsubscribe();
    }, [db, userId, isAuthReady]);

    // Effect for fetching and listening to recurring finances
    useEffect(() => {
        if (!db || !userId || !isAuthReady) {
            return;
        }

        const recurringFinancesDocRef = doc(db, `artifacts/${appId}/users/${userId}/recurringFinances/data`);
        const unsubscribe = onSnapshot(recurringFinancesDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setRecurringIncome(data.income || 0);
                setIncomeFrequency(data.incomeFrequency || 'weekly');
                setBills(data.bills || []);
            } else {
                setRecurringIncome(0);
                setIncomeFrequency('weekly');
                setBills([]);
            }
        }, (error) => {
            console.error("Error listening to recurring finances:", error);
        });

        return () => unsubscribe();
    }, [db, userId, isAuthReady]);

    // Effect for fetching and listening to communication hub messages
    useEffect(() => {
        if (!db || !isAuthReady) {
            return;
        }

        const messagesCollectionRef = collection(db, `artifacts/${appId}/public/data/communicationHub`);
        const unsubscribe = onSnapshot(query(messagesCollectionRef, orderBy('createdAt', 'desc'), limit(20)), (snapshot) => { // Limit to 20 most recent messages
            const fetchedMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMessages(fetchedMessages);
        }, (error) => {
            console.error("Error listening to communication hub messages:", error);
        });

        return () => unsubscribe();
    }, [db, isAuthReady]);


    // Function to fetch a random Bible verse and save it to Firestore
    const fetchAndSaveDailyVerse = async (dateString) => {
        setVerseLoading(true);
        setVerseError(null);
        try {
            const response = await fetch('https://bible-api.com/?random=verse');
            const data = await response.json();

            if (data.text && data.reference) {
                const verseText = data.text.replace(/\n/g, ' ').trim(); // Clean up text
                const verseReference = data.reference;

                const devotionalDocRef = doc(db, `artifacts/${appId}/public/data/dailyDevotionals`, dateString);
                await setDoc(devotionalDocRef, {
                    devotionalText: verseText,
                    devotionalReference: verseReference,
                    createdAt: Date.now()
                }, { merge: true }); // Merge to not overwrite existing thoughts

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
            createdAt: Date.now(), // Timestamp for sorting
            dueDate: dueDate ? new Date(dueDate).getTime() : null, // Store due date as timestamp
        };

        try {
            if (isShared) {
                const sharedTasksCollectionRef = collection(db, `artifacts/${appId}/public/data/sharedTasks`);
                await addDoc(sharedTasksCollectionRef, { ...taskData, ownerId: userId }); // Add ownerId for shared tasks
            } else {
                const privateTasksCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/privateTasks`);
                await addDoc(privateTasksCollectionRef, taskData);
            }
            setNewTaskText(''); // Clear input
            setNewDueDate(''); // Clear due date input
            if (newTaskTextInputRef.current) newTaskTextInputRef.current.value = ''; // Clear text input ref
        } catch (e) {
            console.error("Error adding document: ", e);
        }
    };

    // Function to handle task completion toggle
    const handleToggleCompletion = (task, isShared) => {
        if (!db || !userId) {
            console.error("Firestore or user not ready to update task.");
            return;
        }
        if (task.completed) {
            // If already completed, unmark it
            updateTask(task.id, isShared, {
                completed: false,
                completedBy: null,
                completedComment: null,
            });
        } else {
            // If not completed, open modal for comment
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
            completedBy: userId, // Store the UID of the user who completed it
            completedComment: completionComment.trim() || null, // Store comment or null
        });

        // Reset modal state
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

    // Function to get task suggestions from Gemini API
    const getTaskSuggestions = async (taskText) => {
        setSuggestionLoading(true);
        setTaskForSuggestions(taskText);
        setCurrentSuggestions([]);
        setSuggestionError(null); // Clear previous errors

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

        const apiKey = ""; // As per instructions, leave this empty
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
            setShowSuggestionsModal(true); // Always show modal to display loading/results/error
        }
    };

    // Function to add a suggested sub-task
    const addSuggestedTask = (suggestionText, isShared) => {
        addTask(suggestionText, isShared, null); // Suggested tasks don't have a due date initially
    };

    // --- Authentication Functions ---
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
            setUserId(null); // Clear userId on logout
            setPrivateTasks([]); // Clear tasks on logout
            setSharedTasks([]); // Clear tasks on logout
            setMealPlan({}); // Clear meal plan on logout
            setMealItems([]); // Clear meal items on logout
            setDailyDevotionalThoughts({}); // Clear devotional thoughts on logout
            setDailyVerse({ text: '', reference: '' }); // Clear daily verse
            setHealthMetrics([]); // Clear health metrics on logout
            setFamilyGoals([]); // Clear family goals on logout
            setEvents([]); // Clear events on logout
            setLists([]); // Clear lists on logout
            setShoppingListItems([]); // Clear shopping list items on logout
            setTransactions([]); // Clear transactions on logout
            setRecurringIncome(0); // Clear recurring income
            setIncomeFrequency('weekly'); // Reset income frequency
            setBills([]); // Clear bills
            setMessages([]); // Clear messages
        } catch (error) {
            console.error("Error logging out:", error);
            setAuthError(error.message);
        } finally {
            setAuthLoading(false);
        }
    };

    // Function to add a new meal item to Firestore
    const addMealItem = async (name, type) => {
        if (!db || !userId || !name.trim()) {
            console.error("Cannot add meal item: DB, user, or name is missing.");
            return;
        }
        // Check if item already exists for this user and type
        const existingItem = mealItems.find(item => item.name.toLowerCase() === name.toLowerCase() && item.type === type);
        if (existingItem) {
            console.log(`Meal item "${name}" of type "${type}" already exists.`);
            return existingItem.id; // Return existing ID
        }

        try {
            const mealItemsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/mealItems`);
            const docRef = await addDoc(mealItemsCollectionRef, {
                name: name.trim(),
                type: type,
                createdAt: Date.now()
            });
            console.log("Meal item added successfully with ID:", docRef.id);
            return docRef.id;
        } catch (e) {
            console.error("Error adding meal item: ", e);
            return null;
        }
    };

    // Function to update meal plan
    const updateMealPlan = async (day, mealType, value) => {
        if (!db || !userId) {
            console.error("Firestore or user not ready to update meal plan.");
            return;
        }

        const mealPlanDocRef = doc(db, `artifacts/${appId}/users/${userId}/mealPlan/currentWeek`);
        const updatedMealPlan = {
            ...mealPlan,
            [day]: {
                ...(mealPlan[day] || {}),
                [mealType]: value
            }
        };

        try {
            await setDoc(mealPlanDocRef, updatedMealPlan, { merge: true }); // Merge to update specific fields
        } catch (e) {
            console.error("Error updating meal plan: ", e);
        }
    };

    // Function to update devotional thought for the current user
    const updateDevotionalThought = async (thoughtText) => {
        if (!db || !userId) {
            console.error("Firestore or user not ready to update devotional thought.");
            return;
        }

        const dateString = currentDevotionalDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const devotionalDocRef = doc(db, `artifacts/${appId}/public/data/dailyDevotionals`, dateString);

        try {
            const currentThoughts = dailyDevotionalThoughts || {};
            await setDoc(devotionalDocRef, {
                devotionalText: dailyVerse.text, // Ensure current verse is saved with thought
                devotionalReference: dailyVerse.reference, // Ensure current reference is saved with thought
                thoughts: {
                    ...currentThoughts,
                    [userId]: thoughtText // Update current user's thought
                }
            }, { merge: true }); // Merge to update specific fields without overwriting others
        } catch (e) {
            console.error("Error updating devotional thought: ", e);
        }
    };

    // Function to add a health metric
    const addHealthMetric = async (type, value) => {
        if (!db || !userId) {
            console.error("Firestore or user not ready to add health metric.");
            return;
        }
        if (!value) {
            console.log("Value cannot be empty for health metric.");
            return;
        }

        const metricData = {
            type: type,
            value: value,
            timestamp: Date.now(),
        };

        try {
            const healthMetricsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/healthMetrics`);
            await addDoc(healthMetricsCollectionRef, metricData);
        } catch (e) {
            console.error("Error adding health metric: ", e);
        }
    };

    // Function to add a new family goal
    const addFamilyGoal = async (title) => {
        if (!db || !userId || !title.trim()) {
            console.error("Firestore or user not ready, or title is empty to add goal.");
            return;
        }
        try {
            const goalsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/familyGoals`);
            await addDoc(goalsCollectionRef, {
                title: title.trim(),
                createdAt: Date.now(),
                status: 'active'
            });
            setNewGoalTitle(''); // Clear input
        } catch (e) {
            console.error("Error adding family goal: ", e);
        }
    };

    // Function to add a sub-task to a family goal
    const addGoalSubTask = async (goalId, text) => {
        if (!db || !userId || !goalId || !text.trim()) {
            console.error("Cannot add sub-task: DB, user, goalId, or text is missing.");
            return;
        }
        try {
            const subTasksCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/familyGoals/${goalId}/subTasks`);
            await addDoc(subTasksCollectionRef, {
                text: text.trim(),
                completed: false,
                createdAt: Date.now(),
                completedBy: null,
            });
        } catch (e) {
            console.error("Error adding goal sub-task: ", e);
        }
    };

    // Function to toggle completion of a sub-task within a goal
    const toggleGoalSubTaskCompletion = async (goalId, subTaskId, currentStatus) => {
        if (!db || !userId || !goalId || !subTaskId) {
            console.error("Cannot toggle sub-task: DB, user, goalId, or subTaskId is missing.");
            return;
        }
        try {
            const subTaskDocRef = doc(db, `artifacts/${appId}/users/${userId}/familyGoals/${goalId}/subTasks`, subTaskId);
            await updateDoc(subTaskDocRef, {
                completed: !currentStatus,
                completedBy: !currentStatus ? userId : null,
            });
        } catch (e) {
            console.error("Error toggling goal sub-task completion: ", e);
        }
    };

    // Function to delete a sub-task within a goal
    const deleteGoalSubTask = async (goalId, subTaskId) => {
        if (!db || !userId || !goalId || !subTaskId) {
            console.error("Cannot delete sub-task: DB, user, goalId, or subTaskId is missing.");
            return;
        }
        try {
            const subTaskDocRef = doc(db, `artifacts/${appId}/users/${userId}/familyGoals/${goalId}/subTasks`, subTaskId);
            await deleteDoc(subTaskDocRef);
        } catch (e) {
            console.error("Error deleting goal sub-task: ", e);
        }
    };

    // Function to delete a main goal and all its sub-tasks
    const deleteFamilyGoal = async (goalId) => {
        if (!db || !userId || !goalId) {
            console.error("Cannot delete goal: DB, user, or goalId is missing.");
            return;
        }
        try {
            // Delete all sub-tasks first
            const subTasksCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/familyGoals/${goalId}/subTasks`);
            const subTasksSnapshot = await getDocs(subTasksCollectionRef);
            const deleteSubTasksPromises = subTasksSnapshot.docs.map(subTaskDoc => deleteDoc(subTaskDoc.ref));
            await Promise.all(deleteSubTasksPromises);

            // Then delete the main goal document
            const goalDocRef = doc(db, `artifacts/${appId}/users/${userId}/familyGoals`, goalId);
            await deleteDoc(goalDocRef);
        } catch (e) {
            console.error("Error deleting family goal and its sub-tasks: ", e);
        }
    };

    // --- Event Planning Functions ---
    const addEvent = async (title, date) => {
        if (!db || !userId || !title.trim()) {
            console.error("Cannot add event: DB, user, or title is missing.");
            return;
        }
        try {
            const eventsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/events`);
            await addDoc(eventsCollectionRef, {
                title: title.trim(),
                date: date ? new Date(date).getTime() : null,
                sections: [], // Initialize with empty sections array
                createdAt: Date.now()
            });
            setNewEventTitle('');
            setNewEventDate('');
        } catch (e) {
            console.error("Error adding event: ", e);
        }
    };

    const addEventSection = async (eventId, sectionTitle) => {
        if (!db || !userId || !eventId || !sectionTitle.trim()) {
            console.error("Cannot add event section: DB, user, eventId, or title is missing.");
            return;
        }
        const eventDocRef = doc(db, `artifacts/${appId}/users/${userId}/events`, eventId);
        const eventToUpdate = events.find(event => event.id === eventId);

        if (eventToUpdate) {
            const updatedSections = [...eventToUpdate.sections, {
                id: crypto.randomUUID(),
                title: sectionTitle.trim(),
                items: []
            }];
            try {
                await updateDoc(eventDocRef, { sections: updatedSections });
            } catch (e) {
                console.error("Error adding event section: ", e);
            }
        }
    };

    const addEventItem = async (eventId, sectionId, itemText) => {
        if (!db || !userId || !eventId || !sectionId || !itemText.trim()) {
            console.error("Cannot add event item: DB, user, eventId, sectionId, or text is missing.");
            return;
        }
        const eventDocRef = doc(db, `artifacts/${appId}/users/${userId}/events`, eventId);
        const eventToUpdate = events.find(event => event.id === eventId);

        if (eventToUpdate) {
            const updatedSections = eventToUpdate.sections.map(section => {
                if (section.id === sectionId) {
                    return {
                        ...section,
                        items: [...section.items, {
                            id: crypto.randomUUID(),
                            text: itemText.trim(),
                            completed: false
                        }]
                    };
                }
                return section;
            });
            try {
                await updateDoc(eventDocRef, { sections: updatedSections });
            } catch (e) {
                console.error("Error adding event item: ", e);
            }
        }
    };

    const toggleEventItemCompletion = async (eventId, sectionId, itemId, currentStatus) => {
        if (!db || !userId || !eventId || !sectionId || !itemId) {
            console.error("Cannot toggle event item: DB, user, eventId, sectionId, or itemId is missing.");
            return;
        }
        const eventDocRef = doc(db, `artifacts/${appId}/users/${userId}/events`, eventId);
        const eventToUpdate = events.find(event => event.id === eventId);

        if (eventToUpdate) {
            const updatedSections = eventToUpdate.sections.map(section => {
                if (section.id === sectionId) {
                    return {
                        ...section,
                        items: section.items.map(item => {
                            if (item.id === itemId) {
                                return { ...item, completed: !currentStatus };
                            }
                            return item;
                        })
                    };
                }
                return section;
            });
            try {
                await updateDoc(eventDocRef, { sections: updatedSections });
            } catch (e) {
                console.error("Error toggling event item completion: ", e);
            }
        }
    };

    const deleteEvent = async (eventId) => {
        if (!db || !userId || !eventId) {
            console.error("Cannot delete event: DB, user, or eventId is missing.");
            return;
        }
        try {
            const eventDocRef = doc(db, `artifacts/${appId}/users/${userId}/events`, eventId);
            await deleteDoc(eventDocRef);
        } catch (e) {
            console.error("Error deleting event: ", e);
        }
    };

    const deleteEventSection = async (eventId, sectionId) => {
        if (!db || !userId || !eventId || !sectionId) {
            console.error("Cannot delete event section: DB, user, eventId, or sectionId is missing.");
            return;
        }
        const eventDocRef = doc(db, `artifacts/${appId}/users/${userId}/events`, eventId);
        const eventToUpdate = events.find(event => event.id === eventId);

        if (eventToUpdate) {
            const updatedSections = eventToUpdate.sections.filter(section => section.id !== sectionId);
            try {
                await updateDoc(eventDocRef, { sections: updatedSections });
            } catch (e) {
                console.error("Error deleting event section: ", e);
            }
        }
    };

    const deleteEventItem = async (eventId, sectionId, itemId) => {
        if (!db || !userId || !eventId || !sectionId || !itemId) {
            console.error("Cannot delete event item: DB, user, eventId, sectionId, or itemId is missing.");
            return;
        }
        const eventDocRef = doc(db, `artifacts/${appId}/users/${userId}/events`, eventId);
        const eventToUpdate = events.find(event => event.id === eventId);

        if (eventToUpdate) {
            const updatedSections = eventToUpdate.sections.map(section => {
                if (section.id === sectionId) {
                    return {
                        ...section,
                        items: section.items.filter(item => item.id !== itemId)
                    };
                }
                return section;
            });
            try {
                await updateDoc(eventDocRef, { sections: updatedSections });
            } catch (e) {
                console.error("Error deleting event item: ", e);
            }
        }
    };

    // --- List Functions ---
    const addList = async (title) => {
        if (!db || !userId || !title.trim()) {
            console.error("Cannot add list: DB, user, or title is missing.");
            return;
        }
        try {
            const listsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/lists`);
            await addDoc(listsCollectionRef, {
                title: title.trim(),
                sections: [], // Initialize with empty sections array
                createdAt: Date.now()
            });
            setNewListTitle('');
        } catch (e) {
            console.error("Error adding list: ", e);
        }
    };

    const addListSection = async (listId, sectionTitle) => {
        if (!db || !userId || !listId || !sectionTitle.trim()) {
            console.error("Cannot add list section: DB, user, listId, or title is missing.");
            return;
        }
        const listDocRef = doc(db, `artifacts/${appId}/users/${userId}/lists`, listId);
        const listToUpdate = lists.find(list => list.id === listId);

        if (listToUpdate) {
            const updatedSections = [...listToUpdate.sections, {
                id: crypto.randomUUID(),
                title: sectionTitle.trim(),
                items: [],
                createdAt: Date.now()
            }];
            try {
                await updateDoc(listDocRef, { sections: updatedSections });
            } catch (e) {
                console.error("Error adding list section: ", e);
            }
        }
    };

    const addListItem = async (listId, sectionId, itemText) => {
        if (!db || !userId || !listId || !sectionId || !itemText.trim()) {
            console.error("Cannot add list item: DB, user, listId, sectionId, or text is missing.");
            return;
        }
        const listDocRef = doc(db, `artifacts/${appId}/users/${userId}/lists`, listId);
        const listToUpdate = lists.find(list => list.id === listId);

        if (listToUpdate) {
            const updatedSections = listToUpdate.sections.map(section => {
                if (section.id === sectionId) {
                    return {
                        ...section,
                        items: [...section.items, {
                            id: crypto.randomUUID(),
                            text: itemText.trim(),
                            completed: false,
                            createdAt: Date.now()
                        }]
                    };
                }
                return section;
            });
            try {
                await updateDoc(listDocRef, { sections: updatedSections });
            } catch (e) {
                console.error("Error adding list item: ", e);
            }
        }
    };

    const toggleListItemCompletion = async (listId, sectionId, itemId, currentStatus) => {
        if (!db || !userId || !listId || !sectionId || !itemId) {
            console.error("Cannot toggle list item: DB, user, listId, sectionId, or itemId is missing.");
            return;
        }
        const listDocRef = doc(db, `artifacts/${appId}/users/${userId}/lists`, listId);
        const listToUpdate = lists.find(list => list.id === listId);

        if (listToUpdate) {
            const updatedSections = listToUpdate.sections.map(section => {
                if (section.id === sectionId) {
                    return {
                        ...section,
                        items: section.items.map(item => {
                            if (item.id === itemId) {
                                return { ...item, completed: !currentStatus };
                            }
                            return item;
                        })
                    };
                }
                return section;
            });
            try {
                await updateDoc(listDocRef, { sections: updatedSections });
            } catch (e) {
                console.error("Error toggling list item completion: ", e);
            }
        }
    };

    const deleteList = async (listId) => {
        if (!db || !userId || !listId) {
            console.error("Cannot delete list: DB, user, or listId is missing.");
            return;
        }
        try {
            const listDocRef = doc(db, `artifacts/${appId}/users/${userId}/lists`, listId);
            await deleteDoc(listDocRef);
        } catch (e) {
            console.error("Error deleting list: ", e);
        }
    };

    const deleteListSection = async (listId, sectionId) => {
        if (!db || !userId || !listId || !sectionId) {
            console.error("Cannot delete list section: DB, user, listId, or sectionId is missing.");
            return;
        }
        const listDocRef = doc(db, `artifacts/${appId}/users/${userId}/lists`, listId);
        const listToUpdate = lists.find(list => list.id === listId);

        if (listToUpdate) {
            const updatedSections = listToUpdate.sections.filter(section => section.id !== sectionId);
            try {
                await updateDoc(listDocRef, { sections: updatedSections });
            } catch (e) {
                console.error("Error deleting list section: ", e);
            }
        }
    };

    const deleteListItem = async (listId, sectionId, itemId) => {
        if (!db || !userId || !listId || !sectionId || !itemId) {
            console.error("Cannot delete list item: DB, user, listId, sectionId, or itemId is missing.");
            return;
        }
        const listDocRef = doc(db, `artifacts/${appId}/users/${userId}/lists`, listId);
        const listToUpdate = lists.find(list => list.id === listId);

        if (listToUpdate) {
            const updatedSections = listToUpdate.sections.map(section => {
                if (section.id === sectionId) {
                    return {
                        ...section,
                        items: section.items.filter(item => item.id !== itemId)
                    };
                }
                return section;
            });
            try {
                await updateDoc(listDocRef, { sections: updatedSections });
            } catch (e) {
                console.error("Error deleting list item: ", e);
            }
        }
    };

    // --- Shopping List Functions ---
    const addShoppingListItem = async (text) => {
        if (!db || !text.trim()) { // Shopping list is public, no userId check needed for adding
            console.error("Cannot add shopping list item: DB or text is missing.");
            return;
        }
        try {
            const shoppingListCollectionRef = collection(db, `artifacts/${appId}/public/data/shoppingList`);
            await addDoc(shoppingListCollectionRef, {
                text: text.trim(),
                completed: false,
                createdAt: Date.now(),
                addedBy: userId // Track who added it
            });
        } catch (e) {
            console.error("Error adding shopping list item: ", e);
        }
    };

    const toggleShoppingListItemCompletion = async (itemId, currentStatus) => {
        if (!db || !itemId) {
            console.error("Cannot toggle shopping list item: DB or itemId is missing.");
            return;
        }
        try {
            const itemDocRef = doc(db, `artifacts/${appId}/public/data/shoppingList`, itemId);
            await updateDoc(itemDocRef, {
                completed: !currentStatus,
                completedBy: !currentStatus ? userId : null,
                completedAt: !currentStatus ? Date.now() : null
            });
        } catch (e) {
            console.error("Error toggling shopping list item completion: ", e);
        }
    };

    const deleteShoppingListItem = async (itemId) => {
        if (!db || !itemId) {
            console.error("Cannot delete shopping list item: DB or itemId is missing.");
            return;
        }
        try {
            const itemDocRef = doc(db, `artifacts/${appId}/public/data/shoppingList`, itemId);
            await deleteDoc(itemDocRef);
        } catch (e) {
            console.error("Error deleting shopping list item: ", e);
        }
    };

    // --- Family Budget Functions ---
    const addTransaction = async () => {
        if (!db || !userId || !transactionAmount || !transactionCategory || !transactionDate) {
            console.error("Cannot add transaction: Missing required fields.");
            return;
        }
        const amountNum = parseFloat(transactionAmount);
        if (isNaN(amountNum) || amountNum <= 0) {
            console.error("Invalid amount for transaction.");
            return;
        }

        const transactionData = {
            type: transactionType,
            amount: amountNum,
            category: transactionCategory,
            description: transactionDescription.trim(),
            date: new Date(transactionDate).getTime(), // Store as timestamp
            userId: userId, // Record which user added it
            createdAt: Date.now(),
        };

        try {
            const financesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/finances`);
            await addDoc(financesCollectionRef, transactionData);
            console.log("Transaction added successfully.");
            // Clear form fields
            setTransactionAmount('');
            setTransactionCategory('');
            setTransactionDescription('');
            setTransactionDate(new Date().toISOString().split('T')[0]); // Reset to today
        } catch (e) {
            console.error("Error adding transaction: ", e);
        }
    };

    const deleteTransaction = async (transactionId) => {
        if (!db || !userId || !transactionId) {
            console.error("Cannot delete transaction: DB, user, or transactionId is missing.");
            return;
        }
        try {
            const transactionDocRef = doc(db, `artifacts/${appId}/users/${userId}/finances`, transactionId);
            await deleteDoc(transactionDocRef);
            console.log("Transaction deleted successfully.");
        } catch (e) {
            console.error("Error deleting transaction: ", e);
        }
    };

    // --- Recurring Finance Functions ---
    const updateRecurringIncome = async () => {
        if (!db || !userId || isNaN(parseFloat(recurringIncome))) {
            console.error("Invalid recurring income or user/db not ready.");
            return;
        }
        const recurringFinancesDocRef = doc(db, `artifacts/${appId}/users/${userId}/recurringFinances/data`);
        try {
            await setDoc(recurringFinancesDocRef, {
                income: parseFloat(recurringIncome),
                incomeFrequency: incomeFrequency
            }, { merge: true });
            console.log("Recurring income updated.");
        } catch (e) {
            console.error("Error updating recurring income:", e);
        }
    };

    const addBill = async () => {
        if (!db || !userId || !newBillName.trim() || isNaN(parseFloat(newBillAmount)) || !newBillDueDate || !newBillFrequency) {
            console.error("Cannot add bill: Missing required fields or invalid amount.");
            return;
        }
        const newBill = {
            id: crypto.randomUUID(),
            name: newBillName.trim(),
            amount: parseFloat(newBillAmount),
            dueDate: newBillDueDate,
            frequency: newBillFrequency,
            createdAt: Date.now(),
        };

        const recurringFinancesDocRef = doc(db, `artifacts/${appId}/users/${userId}/recurringFinances/data`);
        try {
            await setDoc(recurringFinancesDocRef, {
                bills: [...bills, newBill]
            }, { merge: true });
            setNewBillName('');
            setNewBillAmount('');
            setNewBillDueDate('');
            setNewBillFrequency('monthly');
            console.log("Bill added successfully.");
        } catch (e) {
            console.error("Error adding bill:", e);
        }
    };

    const deleteBill = async (billId) => {
        if (!db || !userId || !billId) {
            console.error("Cannot delete bill: DB, user, or billId is missing.");
            return;
        }
        const updatedBills = bills.filter(bill => bill.id !== billId);
        const recurringFinancesDocRef = doc(db, `artifacts/${appId}/users/${userId}/recurringFinances/data`);
        try {
            await setDoc(recurringFinancesDocRef, { bills: updatedBills }, { merge: true });
            console.log("Bill deleted successfully.");
        } catch (e) {
            console.error("Error deleting bill:", e);
        }
    };

    // Helper to convert any frequency amount to a weekly amount
    const convertToWeekly = (amount, frequency) => {
        switch (frequency) {
            case 'weekly': return amount;
            case 'fortnightly': return amount / 2;
            case 'monthly': return amount / 4; // Approx 4 weeks per month
            case 'annually': return amount / 52;
            default: return 0;
        }
    };

    // Helper to convert weekly amount to target frequency
    const convertFromWeekly = (weeklyAmount, targetFrequency) => {
        switch (targetFrequency) {
            case 'weekly': return weeklyAmount;
            case 'fortnightly': return weeklyAmount * 2;
            case 'monthly': return weeklyAmount * 4; // Approx 4 weeks per month
            case 'annually': return weeklyAmount * 52;
            default: return 0;
        }
    };

    // Calculate net balance for the selected period
    const calculateNetBalance = () => {
        const incomeWeekly = convertToWeekly(recurringIncome, incomeFrequency);
        const totalBillsWeekly = bills.reduce((sum, bill) => sum + convertToWeekly(bill.amount, bill.frequency), 0);

        const netWeekly = incomeWeekly - totalBillsWeekly;
        return convertFromWeekly(netWeekly, calculationPeriod);
    };

    // --- Communication Hub Functions ---
    const addMessage = async () => {
        if (!db || !userId || !newMessageText.trim()) {
            console.error("Cannot add message: DB, user, or text is missing.");
            return;
        }
        try {
            const messagesCollectionRef = collection(db, `artifacts/${appId}/public/data/communicationHub`);
            await addDoc(messagesCollectionRef, {
                text: newMessageText.trim(),
                senderId: userId,
                createdAt: Date.now()
            });
            setNewMessageText(''); // Clear input
        } catch (e) {
            console.error("Error adding message: ", e);
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
                        // Disable button while loading, specifically for this task
                        disabled={suggestionLoading && taskForSuggestions === task.text}
                    >
                        {suggestionLoading && taskForSuggestions === task.text ? (
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <span className="mr-1">✨</span>
                        )}
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

    // Custom Calendar Component
    const CustomCalendar = ({ allTasks, selectedDate, onDateChange, currentMonth, onMonthChange }) => {
        const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay(); // 0 for Sunday, 1 for Monday etc.
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();

        const numDays = daysInMonth(year, month);
        const firstDay = firstDayOfMonth(year, month); // Day of week (0-6)
        const prevMonthNumDays = daysInMonth(year, month - 1);

        const calendarDays = [];

        // Add days from previous month
        for (let i = firstDay; i > 0; i--) {
            calendarDays.push({
                date: new Date(year, month - 1, prevMonthNumDays - i + 1),
                isCurrentMonth: false
            });
        }

        // Add days of current month
        for (let i = 1; i <= numDays; i++) {
            calendarDays.push({
                date: new Date(year, month, i),
                isCurrentMonth: true
            });
        }

        // Add days from next month to fill the last row
        const totalCells = 42; // 6 rows * 7 days
        const nextMonthStartDay = new Date(year, month + 1, 1);
        for (let i = 0; calendarDays.length < totalCells; i++) {
            calendarDays.push({
                date: new Date(nextMonthStartDay.getFullYear(), nextMonthStartDay.getMonth(), nextMonthStartDay.getDate() + i),
                isCurrentMonth: false
            });
        }


        const handlePrevMonth = () => {
            onMonthChange(new Date(year, month - 1, 1));
        };

        const handleNextMonth = () => {
            onMonthChange(new Date(year, month + 1, 1));
        };

        const isSameDay = (d1, d2) => {
            return d1.getFullYear() === d2.getFullYear() &&
                   d1.getMonth() === d2.getMonth() &&
                   d1.getDate() === d2.getDate();
        };

        const tileHasTasks = (date) => {
            return allTasks.some(task => {
                if (!task.dueDate) return false;
                const taskDate = new Date(task.dueDate);
                return isSameDay(taskDate, date);
            });
        };

        return (
            <div className="bg-white rounded-lg shadow-md p-4">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-gray-200">
                        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                    </button>
                    <h2 className="text-xl font-semibold text-gray-800">
                        {monthNames[month]} {year}
                    </h2>
                    <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-gray-200">
                        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                    </button>
                </div>
                <div className="grid grid-cols-7 text-center text-sm font-medium text-gray-600 mb-2">
                    {weekdayNames.map(day => <div key={day}>{day}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, index) => (
                        <div
                            key={index}
                            className={`p-2 rounded-lg cursor-pointer flex flex-col items-center justify-center h-16
                                ${day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                                ${isSameDay(day.date, new Date()) ? 'bg-blue-100 font-bold' : ''}
                                ${isSameDay(day.date, selectedDate) && day.isCurrentMonth ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-gray-100'}
                                ${tileHasTasks(day.date) && day.isCurrentMonth && !isSameDay(day.date, selectedDate) ? 'border border-indigo-300' : ''}
                            `}
                            onClick={() => onDateChange(day.date)}
                        >
                            <span className={`${isSameDay(day.date, selectedDate) && day.isCurrentMonth ? 'text-white' : ''}`}>
                                {day.date.getDate()}
                            </span>
                            {tileHasTasks(day.date) && day.isCurrentMonth && (
                                <div className={`dot h-2 w-2 rounded-full mt-1 ${isSameDay(day.date, selectedDate) ? 'bg-white' : 'bg-indigo-500'}`}></div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Calendar View Component Wrapper
    const CalendarView = ({ privateTasks, sharedTasks, onToggleCompletion, onDeleteTask, onGetSuggestions, selectedDate, onDateChange, currentMonth, onMonthChange }) => {
        const allTasks = [...privateTasks, ...sharedTasks];

        // Filter tasks for the selected date
        const tasksForSelectedDate = allTasks.filter(task => {
            if (!task.dueDate) return false;
            const taskDate = new Date(task.dueDate);
            // Ensure comparison is only for date, not time
            return taskDate.toDateString() === selectedDate.toDateString();
        }).sort((a, b) => a.dueDate - b.dueDate); // Sort by due date

        return (
            <div className="p-6 bg-white rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-indigo-800 mb-4 text-center">Task Calendar</h2>
                <div className="flex justify-center mb-6">
                    <CustomCalendar
                        allTasks={allTasks}
                        selectedDate={selectedDate}
                        onDateChange={onDateChange}
                        currentMonth={currentMonth}
                        onMonthChange={onMonthChange}
                    />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3">Tasks for {selectedDate.toLocaleDateString()}:</h3>
                {tasksForSelectedDate.length === 0 ? (
                    <p className="text-gray-500 italic">No tasks scheduled for this date.</p>
                ) : (
                    <div className="space-y-3">
                        {tasksForSelectedDate.map(task => (
                            <TaskItem
                                key={task.id}
                                task={task}
                                isShared={!!task.ownerId} // Determine if shared based on ownerId
                                onToggle={onToggleCompletion}
                                onDelete={onDeleteTask}
                                onGetSuggestions={onGetSuggestions}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // Meal Plan Component
    const MealPlanView = ({ mealPlan, mealItems, onMealChange, onAddMealItem }) => {
        const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        const mealTypes = ["breakfast", "lunch", "dinner", "snack"];

        // Group meal items by type for dropdowns
        const groupedMealItems = mealItems.reduce((acc, item) => {
            acc[item.type] = acc[item.type] || [];
            acc[item.type].push(item.name);
            return acc;
        }, {});

        // State for custom input for each cell
        const [customInputValues, setCustomInputValues] = useState({});

        const handleCustomInputChange = (day, mealType, value) => {
            setCustomInputValues(prev => ({
                ...prev,
                [`${day}-${mealType}`]: value
            }));
        };

        const handleAddAndSelectMeal = async (day, mealType) => {
            const customMealName = customInputValues[`${day}-${mealType}`];
            if (customMealName && customMealName.trim() !== '') {
                // Add to meal items database
                await onAddMealItem(customMealName.trim(), mealType);
                // Select it for the current meal slot
                onMealChange(day, mealType, customMealName.trim());
                // Clear custom input for this cell
                setCustomInputValues(prev => ({
                    ...prev,
                    [`${day}-${mealType}`]: ''
                }));
            }
        };


        return (
            <div className="p-6 bg-white rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-indigo-800 mb-4 text-center">Weekly Meal Plan</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="py-3 px-4 border-b text-left text-sm font-semibold text-gray-600"></th>
                                {days.map(day => (
                                    <th key={day} className="py-3 px-4 border-b text-center text-sm font-semibold text-gray-600 capitalize">
                                        {day}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {mealTypes.map(mealType => (
                                <tr key={mealType}>
                                    <td className="py-3 px-4 border-b text-left font-semibold text-gray-700 capitalize">
                                        {mealType}
                                    </td>
                                    {days.map(day => (
                                        <td key={`${day}-${mealType}`} className="py-2 px-4 border-b">
                                            <div className="flex flex-col gap-1">
                                                {/* Dropdown for existing meals */}
                                                <select
                                                    value={mealPlan[day]?.[mealType] || ''}
                                                    onChange={(e) => onMealChange(day, mealType, e.target.value)}
                                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
                                                >
                                                    <option value="">-- Select Meal --</option>
                                                    {groupedMealItems[mealType] && groupedMealItems[mealType].map(item => (
                                                        <option key={item} value={item}>{item}</option>
                                                    ))}
                                                </select>
                                                {/* Input for adding new custom meal */}
                                                <div className="flex gap-1 mt-1">
                                                    <input
                                                        type="text"
                                                        value={customInputValues[`${day}-${mealType}`] || ''}
                                                        onChange={(e) => handleCustomInputChange(day, mealType, e.target.value)}
                                                        className="flex-grow p-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                                        placeholder="Add custom meal"
                                                    />
                                                    <button
                                                        onClick={() => handleAddAndSelectMeal(day, mealType)}
                                                        className="px-3 py-1 bg-indigo-500 text-white rounded-md text-sm hover:bg-indigo-600 transition duration-150 ease-in-out"
                                                    >
                                                        Add to List
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    // Devotional Plan Component
    const DevotionalView = ({ userId, dailyDevotionalThoughts, currentDevotionalDate, onDateChange, onUpdateThought, dailyVerse, verseLoading, verseError }) => {
        const myThought = dailyDevotionalThoughts[userId] || '';
        const otherUsersThoughts = Object.entries(dailyDevotionalThoughts).filter(([id]) => id !== userId);

        const handleThoughtChange = (e) => {
            onUpdateThought(e.target.value);
        };

        const handlePrevDay = () => {
            const prevDay = new Date(currentDevotionalDate);
            prevDay.setDate(prevDay.getDate() - 1);
            onDateChange(prevDay);
        };

        const handleNextDay = () => {
            const nextDay = new Date(currentDevotionalDate);
            nextDay.setDate(nextDay.getDate() + 1);
            onDateChange(nextDay);
        };

        const formattedDate = currentDevotionalDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        return (
            <div className="p-6 bg-white rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-indigo-800 mb-4 text-center">Daily Devotional</h2>

                <div className="flex justify-between items-center mb-4">
                    <button
                        onClick={handlePrevDay}
                        className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition duration-150 ease-in-out"
                    >
                        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                    </button>
                    <h3 className="text-xl font-semibold text-gray-800">{formattedDate}</h3>
                    <button
                        onClick={handleNextDay}
                        className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition duration-150 ease-in-out"
                    >
                        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                    </button>
                </div>

                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="text-lg font-semibold text-blue-800 mb-2">Today's Devotional Content:</h4>
                    {verseLoading ? (
                        <p className="text-gray-600 italic">Loading verse...</p>
                    ) : verseError ? (
                        <p className="text-red-600 italic">{verseError}</p>
                    ) : (
                        <>
                            <p className="text-gray-700 italic">
                                "{dailyVerse.text}"
                            </p>
                            <p className="text-gray-600 text-right mt-2 font-medium">
                                - {dailyVerse.reference}
                            </p>
                        </>
                    )}
                </div>

                <div className="mb-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">Your Devotional Thought:</h4>
                    <textarea
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-150 ease-in-out"
                        rows="4"
                        placeholder="Write your thoughts here..."
                        value={myThought}
                        onChange={handleThoughtChange}
                    ></textarea>
                </div>

                {otherUsersThoughts.length > 0 && (
                    <div>
                        <h4 className="text-lg font-semibold text-gray-800 mb-3">Other Users' Devotional Thoughts:</h4>
                        <div className="space-y-4">
                            {otherUsersThoughts.map(([otherUserId, thought]) => (
                                <div key={otherUserId} className="p-4 bg-gray-100 rounded-lg shadow-sm">
                                    <p className="font-semibold text-gray-700 mb-1">Thought by: <span className="font-mono break-all">{otherUserId}</span></p>
                                    <p className="text-gray-800 italic">"{thought}"</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {otherUsersThoughts.length === 0 && userId && (
                    <p className="text-gray-500 italic">No other users have shared thoughts for this day yet.</p>
                )}
            </div>
        );
    };

    // Health & Fitness Component
    const HealthFitnessView = ({ userId, healthMetrics, onAddMetric }) => {
        const [currentExerciseText, setCurrentExerciseText] = useState('');
        const [currentWeightValue, setCurrentWeightValue] = useState('');
        const [currentStepsCount, setCurrentStepsCount] = useState('');
        const [currentSleepHours, setCurrentSleepHours] = useState('');

        const getRecentMetrics = (type, count = 5) => {
            return healthMetrics.filter(metric => metric.type === type)
                                .slice(0, count); // Get most recent 'count' items
        };

        return (
            <div className="p-6 bg-white rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-indigo-800 mb-6 text-center">Health & Fitness Tracker</h2>

                {/* Exercise Tracker */}
                <div className="mb-8 p-4 bg-gray-50 rounded-lg shadow-inner">
                    <h3 className="text-xl font-semibold text-gray-800 mb-3">Log Exercise</h3>
                    <div className="flex flex-col sm:flex-row gap-3 items-center">
                        <input
                            type="text"
                            placeholder="Describe your exercise (e.g., '30 min run')"
                            value={currentExerciseText}
                            onChange={(e) => setCurrentExerciseText(e.target.value)}
                            className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <button
                            onClick={() => onAddMetric('exercise', currentExerciseText)}
                            className="px-5 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-150 ease-in-out"
                        >
                            Add Exercise
                        </button>
                    </div>
                    <div className="mt-4">
                        <h4 className="text-md font-medium text-gray-700 mb-2">Recent Exercises:</h4>
                        {getRecentMetrics('exercise').length === 0 ? (
                            <p className="text-gray-500 italic text-sm">No exercises logged yet.</p>
                        ) : (
                            <ul className="list-disc pl-5 text-gray-800 text-sm">
                                {getRecentMetrics('exercise').map((metric) => (
                                    <li key={metric.id}>{metric.value} - {new Date(metric.timestamp).toLocaleDateString()}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Weight Tracker */}
                <div className="mb-8 p-4 bg-gray-50 rounded-lg shadow-inner">
                    <h3 className="text-xl font-semibold text-gray-800 mb-3">Log Weight (kg)</h3>
                    <div className="flex flex-col sm:flex-row gap-3 items-center">
                        <input
                            type="number"
                            placeholder="Enter weight in kg"
                            value={currentWeightValue}
                            onChange={(e) => setCurrentWeightValue(e.target.value)}
                            className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <button
                            onClick={() => onAddMetric('weight', parseFloat(currentWeightValue))}
                            className="px-5 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-150 ease-in-out"
                        >
                            Add Weight
                        </button>
                    </div>
                    <div className="mt-4">
                        <h4 className="text-md font-medium text-gray-700 mb-2">Recent Weight Logs:</h4>
                        {getRecentMetrics('weight').length === 0 ? (
                            <p className="text-gray-500 italic text-sm">No weight logged yet.</p>
                        ) : (
                            <ul className="list-disc pl-5 text-gray-800 text-sm">
                                {getRecentMetrics('weight').map((metric) => (
                                    <li key={metric.id}>{metric.value} kg - {new Date(metric.timestamp).toLocaleDateString()}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Steps Tracker */}
                <div className="mb-8 p-4 bg-gray-50 rounded-lg shadow-inner">
                    <h3 className="text-xl font-semibold text-gray-800 mb-3">Log Steps</h3>
                    <div className="flex flex-col sm:flex-row gap-3 items-center">
                        <input
                            type="number"
                            placeholder="Enter step count"
                            value={currentStepsCount}
                            onChange={(e) => setCurrentStepsCount(e.target.value)}
                            className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <button
                            onClick={() => onAddMetric('steps', parseInt(currentStepsCount))}
                            className="px-5 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-150 ease-in-out"
                        >
                            Add Steps
                        </button>
                    </div>
                    <div className="mt-4">
                        <h4 className="text-md font-medium text-gray-700 mb-2">Recent Step Logs:</h4>
                        {getRecentMetrics('steps').length === 0 ? (
                            <p className="text-gray-500 italic text-sm">No steps logged yet.</p>
                        ) : (
                            <ul className="list-disc pl-5 text-gray-800 text-sm">
                                {getRecentMetrics('steps').map((metric) => (
                                    <li key={metric.id}>{metric.value} steps - {new Date(metric.timestamp).toLocaleDateString()}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Sleep Tracker */}
                <div className="p-4 bg-gray-50 rounded-lg shadow-inner">
                    <h3 className="text-xl font-semibold text-gray-800 mb-3">Log Sleep (hours)</h3>
                    <div className="flex flex-col sm:flex-row gap-3 items-center">
                        <input
                            type="number"
                            step="0.1"
                            placeholder="Enter hours of sleep"
                            value={currentSleepHours}
                            onChange={(e) => setCurrentSleepHours(e.target.value)}
                            className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <button
                            onClick={() => onAddMetric('sleep', parseFloat(currentSleepHours))}
                            className="px-5 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-150 ease-in-out"
                        >
                            Add Sleep
                        </button>
                    </div>
                    <div className="mt-4">
                        <h4 className="text-md font-medium text-gray-700 mb-2">Recent Sleep Logs:</h4>
                        {getRecentMetrics('sleep').length === 0 ? (
                            <p className="text-gray-500 italic text-sm">No sleep logged yet.</p>
                        ) : (
                            <ul className="list-disc pl-5 text-gray-800 text-sm">
                                {getRecentMetrics('sleep').map((metric) => (
                                    <li key={metric.id}>{metric.value} hours - {new Date(metric.timestamp).toLocaleDateString()}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Family Goals Component
    const FamilyGoalsView = ({ userId, familyGoals, onAddGoal, onAddSubTask, onToggleSubTaskCompletion, onDeleteSubTask, onDeleteGoal }) => {
        const [currentSubTaskText, setCurrentSubTaskText] = useState({}); // State to hold sub-task text for each goal

        const handleAddSubTask = (goalId) => {
            const text = currentSubTaskText[goalId];
            if (text && text.trim() !== '') {
                onAddSubTask(goalId, text);
                setCurrentSubTaskText(prev => ({ ...prev, [goalId]: '' })); // Clear specific input
            }
        };

        return (
            <div className="p-6 bg-white rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-indigo-800 mb-6 text-center">Family Goals & Projects</h2>

                {/* Add New Goal */}
                <div className="mb-8 p-4 bg-gray-50 rounded-lg shadow-inner">
                    <h3 className="text-xl font-semibold text-gray-800 mb-3">Add a New Family Goal</h3>
                    <div className="flex flex-col sm:flex-row gap-3 items-center">
                        <input
                            type="text"
                            placeholder="e.g., 'Renovate Bathroom', 'Save for a Trip'"
                            value={newGoalTitle}
                            onChange={(e) => setNewGoalTitle(e.target.value)}
                            className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <button
                            onClick={() => onAddGoal(newGoalTitle)}
                            className="px-5 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-150 ease-in-out"
                        >
                            Add Goal
                        </button>
                    </div>
                </div>

                {/* List of Goals */}
                {familyGoals.length === 0 ? (
                    <p className="text-gray-500 italic text-center">No family goals defined yet. Add one above!</p>
                ) : (
                    <div className="space-y-8">
                        {familyGoals.map(goal => (
                            <div key={goal.id} className="p-6 bg-blue-50 rounded-xl shadow-md">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xl font-bold text-blue-800">{goal.title}</h3>
                                    <button
                                        onClick={() => onDeleteGoal(goal.id)}
                                        className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition duration-150 ease-in-out"
                                        aria-label="Delete goal"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                </div>

                                {/* Add Sub-task for this Goal */}
                                <div className="mb-4 flex flex-col sm:flex-row gap-3 items-center">
                                    <input
                                        type="text"
                                        placeholder="Add a sub-task for this goal..."
                                        value={currentSubTaskText[goal.id] || ''}
                                        onChange={(e) => setCurrentSubTaskText(prev => ({ ...prev, [goal.id]: e.target.value }))}
                                        className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                                    />
                                    <button
                                        onClick={() => handleAddSubTask(goal.id)}
                                        className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition duration-150 ease-in-out text-sm"
                                    >
                                        Add Sub-task
                                    </button>
                                </div>

                                {/* List of Sub-tasks */}
                                {goal.subTasks && goal.subTasks.length > 0 ? (
                                    <ul className="space-y-2">
                                        {goal.subTasks.map(subTask => (
                                            <li key={subTask.id} className="flex items-center justify-between p-2 bg-white rounded-md shadow-sm">
                                                <div className="flex items-center flex-grow">
                                                    <input
                                                        type="checkbox"
                                                        checked={subTask.completed}
                                                        onChange={() => onToggleSubTaskCompletion(goal.id, subTask.id, subTask.completed)}
                                                        className="form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                                    />
                                                    <span className={`ml-2 text-md ${subTask.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                                                        {subTask.text}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => onDeleteSubTask(goal.id, subTask.id)}
                                                    className="p-1 rounded-full text-red-500 hover:bg-red-100 transition duration-150 ease-in-out"
                                                    aria-label="Delete sub-task"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-gray-500 italic text-sm">No sub-tasks for this goal yet.</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // Event Planning Component
    const EventPlanningView = ({ events, onAddEvent, onAddEventSection, onAddEventItem, onToggleEventItemCompletion, onDeleteEvent, onDeleteEventSection, onDeleteEventItem }) => {
        const [newEventSectionTitle, setNewEventSectionTitle] = useState({}); // {eventId: title}
        const [newEventItemText, setNewEventItemText] = useState({}); // {eventId_sectionId: text}

        const handleAddSection = (eventId) => {
            const title = newEventSectionTitle[eventId];
            if (title && title.trim() !== '') {
                onAddEventSection(eventId, title);
                setNewEventSectionTitle(prev => ({ ...prev, [eventId]: '' }));
            }
        };

        const handleAddItem = (eventId, sectionId) => {
            const text = newEventItemText[`${eventId}_${sectionId}`];
            if (text && text.trim() !== '') {
                onAddEventItem(eventId, sectionId, text);
                setNewEventItemText(prev => ({ ...prev, [`${eventId}_${sectionId}`]: '' }));
            }
        };

        return (
            <div className="p-6 bg-white rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-indigo-800 mb-6 text-center">Event Planning</h2>

                {/* Add New Event */}
                <div className="mb-8 p-4 bg-gray-50 rounded-lg shadow-inner">
                    <h3 className="text-xl font-semibold text-gray-800 mb-3">Create a New Event</h3>
                    <div className="flex flex-col sm:flex-row gap-3 items-center mb-3">
                        <input
                            type="text"
                            placeholder="Event Title (e.g., 'Grayson's Birthday')"
                            value={newEventTitle}
                            onChange={(e) => setNewEventTitle(e.target.value)}
                            className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <input
                            type="date"
                            value={newEventDate}
                            onChange={(e) => setNewEventDate(e.target.value)}
                            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>
                    <button
                        onClick={() => onAddEvent(newEventTitle, newEventDate)}
                        className="px-5 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-150 ease-in-out w-full sm:w-auto"
                    >
                        Add Event
                    </button>
                </div>

                {/* List of Events */}
                {events.length === 0 ? (
                    <p className="text-gray-500 italic text-center">No events planned yet. Create one above!</p>
                ) : (
                    <div className="space-y-8">
                        {events.map(event => (
                            <div key={event.id} className="p-6 bg-blue-50 rounded-xl shadow-md">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xl font-bold text-blue-800">{event.title} {event.date && <span className="text-base font-normal text-gray-600">({new Date(event.date).toLocaleDateString()})</span>}
                                    </h3>
                                    <button
                                        onClick={() => onDeleteEvent(event.id)}
                                        className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition duration-150 ease-in-out"
                                        aria-label="Delete event"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                </div>

                                {/* Add Section for this Event */}
                                <div className="mb-4 flex flex-col sm:flex-row gap-3 items-center">
                                    <input
                                        type="text"
                                        placeholder="Add a section (e.g., 'Food', 'Presents')"
                                        value={newEventSectionTitle[event.id] || ''}
                                        onChange={(e) => setNewEventSectionTitle(prev => ({ ...prev, [event.id]: e.target.value }))}
                                        className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                                    />
                                    <button
                                        onClick={() => handleAddSection(event.id)}
                                        className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition duration-150 ease-in-out text-sm"
                                    >
                                        Add Section
                                    </button>
                                </div>

                                {/* List of Sections and their Items */}
                                {event.sections && event.sections.length > 0 ? (
                                    <div className="space-y-6 mt-4">
                                        {event.sections.map(section => (
                                            <div key={section.id} className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                                                <div className="flex justify-between items-center mb-3">
                                                    <h4 className="text-lg font-semibold text-gray-800">{section.title}</h4>
                                                    <button
                                                        onClick={() => onDeleteEventSection(event.id, section.id)}
                                                        className="p-1 rounded-full text-red-500 hover:bg-red-100 transition duration-150 ease-in-out"
                                                        aria-label="Delete section"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                    </button>
                                                </div>

                                                {/* Add Item for this Section */}
                                                <div className="mb-3 flex flex-col sm:flex-row gap-2 items-center">
                                                    <input
                                                        type="text"
                                                        placeholder="Add an item to this checklist..."
                                                        value={newEventItemText[`${event.id}_${section.id}`] || ''}
                                                        onChange={(e) => setNewEventItemText(prev => ({ ...prev, [`${event.id}_${section.id}`]: e.target.value }))}
                                                        className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-transparent text-sm"
                                                    />
                                                    <button
                                                        onClick={() => handleAddItem(event.id, section.id, newEventItemText[`${event.id}_${section.id}`])}
                                                        className="px-3 py-2 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 transition duration-150 ease-in-out text-sm"
                                                    >
                                                        Add Item
                                                    </button>
                                                </div>

                                                {/* List of Items */}
                                                {section.items && section.items.length > 0 ? (
                                                    <ul className="space-y-1">
                                                        {section.items.map(item => (
                                                            <li key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                                                                <div className="flex items-center flex-grow">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={item.completed}
                                                                        onChange={() => onToggleEventItemCompletion(event.id, section.id, item.id, item.completed)}
                                                                        className="form-checkbox h-4 w-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                                                                    />
                                                                    <span className={`ml-2 text-sm ${item.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                                                                        {item.text}
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    onClick={() => onDeleteEventItem(event.id, section.id, item.id)}
                                                                    className="p-1 rounded-full text-red-500 hover:bg-red-100 transition duration-150 ease-in-out"
                                                                    aria-label="Delete item"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                                </button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <p className="text-gray-500 italic text-sm">No items in this section yet.</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 italic text-sm">No sections for this event yet. Add one above!</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // Lists Component
    const ListsView = ({ userId, lists, onAddList, onAddListSection, onAddListItem, onToggleListItemCompletion, onDeleteList, onDeleteListSection, onDeleteListItem, shoppingListItems, onAddShoppingListItem, onToggleShoppingListItemCompletion, onDeleteShoppingListItem }) => {
        const [newListSectionTitle, setNewListSectionTitle] = useState({}); // {listId: title}
        const [newListItemText, setNewListItemText] = useState({}); // {listId_sectionId: text}
        const [newShoppingListItemText, setNewShoppingListItemText] = useState('');

        const handleAddSection = (listId) => {
            const title = newListSectionTitle[listId];
            if (title && title.trim() !== '') {
                onAddListSection(listId, title);
                setNewListSectionTitle(prev => ({ ...prev, [listId]: '' }));
            }
        };

        const handleAddItem = (listId, sectionId) => {
            const text = newListItemText[`${listId}_${sectionId}`];
            if (text && text.trim() !== '') {
                onAddListItem(listId, sectionId, text);
                setNewListItemText(prev => ({ ...prev, [`${listId}_${sectionId}`]: '' }));
            }
        };

        return (
            <div className="p-6 bg-white rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-indigo-800 mb-6 text-center">My Custom Lists</h2>

                {/* Shopping List Section */}
                <div className="mb-8 p-4 bg-green-50 rounded-lg shadow-inner">
                    <h3 className="text-xl font-semibold text-green-800 mb-3">Shopping List (Shared)</h3>
                    <div className="flex flex-col sm:flex-row gap-3 items-center mb-4">
                        <input
                            type="text"
                            placeholder="Add item to shopping list..."
                            value={newShoppingListItemText}
                            onChange={(e) => setNewShoppingListItemText(e.target.value)}
                            className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                        <button
                            onClick={() => {
                                onAddShoppingListItem(newShoppingListItemText);
                                setNewShoppingListItemText('');
                            }}
                            className="px-5 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition duration-150 ease-in-out"
                        >
                            Add Item
                        </button>
                    </div>
                    {shoppingListItems.length === 0 ? (
                        <p className="text-gray-500 italic text-sm">No items on the shopping list yet.</p>
                    ) : (
                        <ul className="space-y-2">
                            {shoppingListItems.map(item => (
                                <li key={item.id} className="flex items-center justify-between p-2 bg-white rounded-md shadow-sm">
                                    <div className="flex items-center flex-grow">
                                        <input
                                            type="checkbox"
                                            checked={item.completed}
                                            onChange={() => onToggleShoppingListItemCompletion(item.id, item.completed)}
                                            className="form-checkbox h-4 w-4 text-green-600 rounded focus:ring-green-500 cursor-pointer"
                                        />
                                        <span className={`ml-2 text-md ${item.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                                            {item.text}
                                            {item.completedBy && <span className="text-xs text-gray-500 ml-2">(by {item.completedBy})</span>}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => onDeleteShoppingListItem(item.id)}
                                        className="p-1 rounded-full text-red-500 hover:bg-red-100 transition duration-150 ease-in-out"
                                        aria-label="Delete item"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Add New Custom List */}
                <div className="mb-8 p-4 bg-gray-50 rounded-lg shadow-inner">
                    <h3 className="text-xl font-semibold text-gray-800 mb-3">Create a New Custom List</h3>
                    <div className="flex flex-col sm:flex-row gap-3 items-center">
                        <input
                            type="text"
                            placeholder="List Title (e.g., 'Sabbath School', 'Packing List')"
                            value={newListTitle}
                            onChange={(e) => setNewListTitle(e.target.value)}
                            className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <button
                            onClick={() => onAddList(newListTitle)}
                            className="px-5 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-150 ease-in-out"
                        >
                            Add List
                        </button>
                    </div>
                </div>

                {/* List of Custom Lists */}
                {lists.length === 0 ? (
                    <p className="text-gray-500 italic text-center">No custom lists created yet. Add one above!</p>
                ) : (
                    <div className="space-y-8">
                        {lists.map(list => (
                            <div key={list.id} className="p-6 bg-blue-50 rounded-xl shadow-md">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xl font-bold text-blue-800">{list.title}</h3>
                                    <button
                                        onClick={() => onDeleteList(list.id)}
                                        className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition duration-150 ease-in-out"
                                        aria-label="Delete list"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                </div>

                                {/* Add Section for this List */}
                                <div className="mb-4 flex flex-col sm:flex-row gap-3 items-center">
                                    <input
                                        type="text"
                                        placeholder="Add a sub-heading (e.g., 'Lesson 1', 'Produce')"
                                        value={newListSectionTitle[list.id] || ''}
                                        onChange={(e) => setNewListSectionTitle(prev => ({ ...prev, [list.id]: e.target.value }))}
                                        className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                                    />
                                    <button
                                        onClick={() => handleAddSection(list.id)}
                                        className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition duration-150 ease-in-out text-sm"
                                    >
                                        Add Sub-heading
                                    </button>
                                </div>

                                {/* List of Sections and their Items */}
                                {list.sections && list.sections.length > 0 ? (
                                    <div className="space-y-6 mt-4">
                                        {list.sections.map(section => (
                                            <div key={section.id} className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                                                <div className="flex justify-between items-center mb-3">
                                                    <h4 className="text-lg font-semibold text-gray-800">{section.title}</h4>
                                                    <button
                                                        onClick={() => onDeleteListSection(list.id, section.id)}
                                                        className="p-1 rounded-full text-red-500 hover:bg-red-100 transition duration-150 ease-in-out"
                                                        aria-label="Delete section"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                    </button>
                                                </div>

                                                {/* Add Item for this Section */}
                                                <div className="mb-3 flex flex-col sm:flex-row gap-2 items-center">
                                                    <input
                                                        type="text"
                                                        placeholder="Add an item to this checklist..."
                                                        value={newListItemText[`${list.id}_${section.id}`] || ''}
                                                        onChange={(e) => setNewListItemText(prev => ({ ...prev, [`${list.id}_${section.id}`]: e.target.value }))}
                                                        className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-transparent text-sm"
                                                    />
                                                    <button
                                                        onClick={() => handleAddItem(list.id, section.id, newListItemText[`${list.id}_${section.id}`])}
                                                        className="px-3 py-2 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 transition duration-150 ease-in-out text-sm"
                                                    >
                                                        Add Item
                                                    </button>
                                                </div>

                                                {/* List of Items */}
                                                {section.items && section.items.length > 0 ? (
                                                    <ul className="space-y-1">
                                                        {section.items.map(item => (
                                                            <li key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                                                                <div className="flex items-center flex-grow">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={item.completed}
                                                                        onChange={() => onToggleListItemCompletion(list.id, section.id, item.id, item.completed)}
                                                                        className="form-checkbox h-4 w-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                                                                    />
                                                                    <span className={`ml-2 text-sm ${item.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                                                                        {item.text}
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    onClick={() => onDeleteListItem(list.id, section.id, item.id)}
                                                                    className="p-1 rounded-full text-red-500 hover:bg-red-100 transition duration-150 ease-in-out"
                                                                    aria-label="Delete item"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                                </button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <p className="text-gray-500 italic text-sm">No items in this section yet.</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 italic text-sm">No custom lists created yet. Add one above!</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // Family Budget Component
    const FamilyBudgetView = ({
        transactions, onAddTransaction, onDeleteTransaction,
        transactionType, setTransactionType, transactionAmount, setTransactionAmount,
        transactionCategory, setTransactionCategory, transactionDescription, setTransactionDescription,
        transactionDate, setTransactionDate, expenseCategories, incomeCategories,
        recurringIncome, setRecurringIncome, incomeFrequency, setIncomeFrequency,
        bills, addBill, deleteBill, newBillName, setNewBillName, newBillAmount, setNewBillAmount,
        newBillDueDate, setNewBillDueDate, newBillFrequency, setNewBillFrequency,
        calculationPeriod, setCalculationPeriod, calculateNetBalance, updateRecurringIncome
    }) => {
        const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        const netBalance = totalIncome - totalExpenses;

        return (
            <div className="p-6 bg-white rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-indigo-800 mb-6 text-center">Family Budget</h2>

                {/* Recurring Income Section */}
                <div className="mb-8 p-4 bg-gray-50 rounded-lg shadow-inner">
                    <h3 className="text-xl font-semibold text-gray-800 mb-3">Recurring Income</h3>
                    <div className="flex flex-col sm:flex-row gap-3 items-center mb-3">
                        <input
                            type="number"
                            placeholder="Income Amount"
                            value={recurringIncome}
                            onChange={(e) => setRecurringIncome(parseFloat(e.target.value) || 0)}
                            className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <select
                            value={incomeFrequency}
                            onChange={(e) => setIncomeFrequency(e.target.value)}
                            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                            <option value="weekly">Weekly</option>
                            <option value="fortnightly">Fortnightly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                        <button
                            onClick={updateRecurringIncome}
                            className="px-5 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-150 ease-in-out"
                        >
                            Set Income
                        </button>
                    </div>
                    <p className="text-gray-700 text-sm">Current Recurring Income: ${recurringIncome.toFixed(2)} {incomeFrequency}</p>
                </div>

                {/* Recurring Bills Section */}
                <div className="mb-8 p-4 bg-gray-50 rounded-lg shadow-inner">
                    <h3 className="text-xl font-semibold text-gray-800 mb-3">Recurring Bills</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <input
                            type="text"
                            placeholder="Bill Name"
                            value={newBillName}
                            onChange={(e) => setNewBillName(e.target.value)}
                            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <input
                            type="number"
                            placeholder="Amount"
                            value={newBillAmount}
                            onChange={(e) => setNewBillAmount(e.target.value)}
                            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <input
                            type="text"
                            placeholder="Due Date (e.g., '15' or 'Monday')"
                            value={newBillDueDate}
                            onChange={(e) => setNewBillDueDate(e.target.value)}
                            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <select
                            value={newBillFrequency}
                            onChange={(e) => setNewBillFrequency(e.target.value)}
                            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                            <option value="weekly">Weekly</option>
                            <option value="fortnightly">Fortnightly</option>
                            <option value="monthly">Monthly</option>
                            <option value="annually">Annually</option>
                        </select>
                    </div>
                    <button
                        onClick={addBill}
                        className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-150 ease-in-out w-full"
                    >
                        Add Bill
                    </button>

                    <div className="mt-4">
                        <h4 className="text-md font-medium text-gray-700 mb-2">Current Bills:</h4>
                        {bills.length === 0 ? (
                            <p className="text-gray-500 italic text-sm">No recurring bills added yet.</p>
                        ) : (
                            <ul className="space-y-2">
                                {bills.map(bill => (
                                    <li key={bill.id} className="flex items-center justify-between p-2 bg-white rounded-md shadow-sm">
                                        <span className="text-gray-800">{bill.name}: ${bill.amount.toFixed(2)} {bill.frequency} (Due: {bill.dueDate})</span>
                                        <button
                                            onClick={() => deleteBill(bill.id)}
                                            className="p-1 rounded-full text-red-500 hover:bg-red-100 transition duration-150 ease-in-out"
                                            aria-label="Delete bill"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Periodical Net Balance */}
                <div className="mb-8 p-4 bg-blue-50 rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold text-blue-800 mb-3">Estimated Net Balance</h3>
                    <div className="flex items-center gap-3 mb-4">
                        <label className="text-gray-700">Calculate for:</label>
                        <select
                            value={calculationPeriod}
                            onChange={(e) => setCalculationPeriod(e.target.value)}
                            className="p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="weekly">Weekly</option>
                            <option value="fortnightly">Fortnightly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                    </div>
                    <div className="flex justify-between items-center text-xl font-bold pt-2 border-t border-blue-200">
                        <span>Money Left ({calculationPeriod}):</span>
                        <span className={`${calculateNetBalance() >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            ${calculateNetBalance().toFixed(2)}
                        </span>
                    </div>
                </div>


                {/* Add New Transaction */}
                <div className="mb-8 p-4 bg-gray-50 rounded-lg shadow-inner">
                    <h3 className="text-xl font-semibold text-gray-800 mb-3">Add New Transaction</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                            <select
                                value={transactionType}
                                onChange={(e) => setTransactionType(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            >
                                <option value="expense">Expense</option>
                                <option value="income">Income</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                            <input
                                type="number"
                                placeholder="Amount"
                                value={transactionAmount}
                                onChange={(e) => setTransactionAmount(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                            <select
                                value={transactionCategory}
                                onChange={(e) => setTransactionCategory(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            >
                                <option value="">Select Category</option>
                                {transactionType === 'expense' ? (
                                    expenseCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)
                                ) : (
                                    incomeCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)
                                )}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                            <input
                                type="date"
                                value={transactionDate}
                                onChange={(e) => setTransactionDate(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                        <textarea
                            placeholder="Description"
                            value={transactionDescription}
                            onChange={(e) => setTransactionDescription(e.target.value)}
                            rows="2"
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        ></textarea>
                    </div>
                    <button
                        onClick={onAddTransaction}
                        className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-150 ease-in-out w-full"
                    >
                        Add Transaction
                    </button>
                </div>

                {/* Financial Summary */}
                <div className="mb-8 p-4 bg-blue-50 rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold text-blue-800 mb-3">Financial Summary (All Transactions)</h3>
                    <div className="flex justify-between items-center text-lg font-medium mb-2">
                        <span>Total Income:</span>
                        <span className="text-green-600">${totalIncome.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-lg font-medium mb-2">
                        <span>Total Expenses:</span>
                        <span className="text-red-600">${totalExpenses.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xl font-bold pt-2 border-t border-blue-200">
                        <span>Net Balance:</span>
                        <span className={`${netBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>${netBalance.toFixed(2)}</span>
                    </div>
                </div>

                {/* Recent Transactions */}
                <div className="p-4 bg-gray-50 rounded-lg shadow-inner">
                    <h3 className="text-xl font-semibold text-gray-800 mb-3">Recent Transactions</h3>
                    {transactions.length === 0 ? (
                        <p className="text-gray-500 italic text-center">No transactions recorded yet.</p>
                    ) : (
                        <ul className="space-y-3">
                            {transactions.map(transaction => (
                                <li key={transaction.id} className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
                                    <div className="flex flex-col flex-grow">
                                        <span className={`font-medium ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                            {transaction.type === 'expense' ? '-' : '+'}${transaction.amount.toFixed(2)}
                                        </span>
                                        <span className="text-sm text-gray-700 capitalize">{transaction.category}</span>
                                        {transaction.description && <span className="text-xs text-gray-500 italic">{transaction.description}</span>}
                                        <span className="text-xs text-gray-400">{new Date(transaction.date).toLocaleDateString()}</span>
                                    </div>
                                    <button
                                        onClick={() => onDeleteTransaction(transaction.id)}
                                        className="p-2 rounded-full text-red-500 hover:bg-red-100 transition duration-150 ease-in-out"
                                        aria-label="Delete transaction"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        );
    };

    // Family Communication Hub Component
    const FamilyCommunicationHubView = ({ userId, messages, onAddMessage }) => {
        const [currentMessageText, setCurrentMessageText] = useState('');
        const messagesEndRef = useRef(null); // Ref for scrolling to bottom of messages

        // Scroll to bottom when messages update
        useEffect(() => {
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
            }
        }, [messages]);

        const handleSendMessage = () => {
            if (currentMessageText.trim()) {
                onAddMessage(currentMessageText);
                setCurrentMessageText('');
            }
        };

        return (
            <div className="p-6 bg-white rounded-xl shadow-lg flex flex-col h-[70vh]">
                <h2 className="text-2xl font-bold text-indigo-800 mb-4 text-center">Family Communication Hub</h2>

                {/* Message Display Area */}
                <div className="flex-grow overflow-y-auto p-4 bg-gray-50 rounded-lg mb-4 shadow-inner">
                    {messages.length === 0 ? (
                        <p className="text-gray-500 italic text-center">No messages yet. Start the conversation!</p>
                    ) : (
                        <div className="space-y-3">
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`flex ${message.senderId === userId ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`p-3 rounded-lg max-w-[70%] ${
                                        message.senderId === userId
                                            ? 'bg-indigo-200 text-indigo-900'
                                            : 'bg-gray-200 text-gray-800'
                                    }`}>
                                        <p className="font-semibold text-sm mb-1 break-all">
                                            {message.senderId === userId ? 'You' : message.senderId}:
                                        </p>
                                        <p className="text-base">{message.text}</p>
                                        <p className="text-xs text-gray-600 mt-1 text-right">
                                            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} /> {/* Empty div to scroll to */}
                        </div>
                    )}
                </div>

                {/* Message Input */}
                <div className="flex gap-3">
                    <input
                        type="text"
                        placeholder="Type your message..."
                        value={currentMessageText}
                        onChange={(e) => setNewMessageText(e.target.value)}
                        onKeyPress={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
                        className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <button
                        onClick={handleSendMessage}
                        className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75 transition duration-150 ease-in-out"
                    >
                        Send
                    </button>
                </div>
            </div>
        );
    };


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
                            <button
                                onClick={() => setCurrentView('calendar')}
                                className={`px-6 py-3 rounded-lg font-semibold transition duration-150 ease-in-out ${currentView === 'calendar' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                            >
                                Calendar
                            </button>
                            <button
                                onClick={() => setCurrentView('mealPlan')}
                                className={`px-6 py-3 rounded-lg font-semibold transition duration-150 ease-in-out ${currentView === 'mealPlan' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                            >
                                Meal Plan
                            </button>
                            <button
                                onClick={() => setCurrentView('devotional')}
                                className={`px-6 py-3 rounded-lg font-semibold transition duration-150 ease-in-out ${currentView === 'devotional' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                            >
                                Devotional
                            </button>
                            <button
                                onClick={() => setCurrentView('healthFitness')}
                                className={`px-6 py-3 rounded-lg font-semibold transition duration-150 ease-in-out ${currentView === 'healthFitness' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                            >
                                Health & Fitness
                            </button>
                            <button
                                onClick={() => setCurrentView('familyGoals')}
                                className={`px-6 py-3 rounded-lg font-semibold transition duration-150 ease-in-out ${currentView === 'familyGoals' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                            >
                                Family Goals
                            </button>
                            <button
                                onClick={() => setCurrentView('eventPlanning')}
                                className={`px-6 py-3 rounded-lg font-semibold transition duration-150 ease-in-out ${currentView === 'eventPlanning' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                            >
                                Event Planning
                            </button>
                            <button
                                onClick={() => setCurrentView('lists')}
                                className={`px-6 py-3 rounded-lg font-semibold transition duration-150 ease-in-out ${currentView === 'lists' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                            >
                                Lists
                            </button>
                            <button
                                onClick={() => setCurrentView('budget')}
                                className={`px-6 py-3 rounded-lg font-semibold transition duration-150 ease-in-out ${currentView === 'budget' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                            >
                                Family Budget
                            </button>
                            <button
                                onClick={() => setCurrentView('communicationHub')}
                                className={`px-6 py-3 rounded-lg font-semibold transition duration-150 ease-in-out ${currentView === 'communicationHub' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                            >
                                Communication Hub
                            </button>
                        </div>

                        {/* Conditional Rendering of Views */}
                        {currentView === 'tasks' ? (
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
                        ) : currentView === 'calendar' ? (
                            <CalendarView
                                privateTasks={privateTasks}
                                sharedTasks={sharedTasks}
                                onToggleCompletion={handleToggleCompletion}
                                onDeleteTask={deleteTask}
                                onGetSuggestions={getTaskSuggestions}
                                selectedDate={selectedCalendarDate}
                                onDateChange={setSelectedCalendarDate}
                                currentMonth={currentMonth}
                                onMonthChange={setCurrentMonth}
                            />
                        ) : currentView === 'mealPlan' ? (
                            <MealPlanView
                                mealPlan={mealPlan}
                                mealItems={mealItems}
                                onMealChange={updateMealPlan}
                                onAddMealItem={addMealItem}
                            />
                        ) : currentView === 'devotional' ? (
                            <DevotionalView
                                userId={userId}
                                dailyDevotionalThoughts={dailyDevotionalThoughts}
                                currentDevotionalDate={currentDevotionalDate}
                                onDateChange={setCurrentDevotionalDate}
                                onUpdateThought={updateDevotionalThought}
                                dailyVerse={dailyVerse}
                                verseLoading={verseLoading}
                                verseError={verseError}
                            />
                        ) : currentView === 'healthFitness' ? (
                            <HealthFitnessView
                                userId={userId}
                                healthMetrics={healthMetrics}
                                onAddMetric={addHealthMetric}
                            />
                        ) : currentView === 'familyGoals' ? (
                            <FamilyGoalsView
                                userId={userId}
                                familyGoals={familyGoals}
                                onAddGoal={addFamilyGoal}
                                onAddSubTask={addGoalSubTask}
                                onToggleSubTaskCompletion={toggleGoalSubTaskCompletion}
                                onDeleteSubTask={deleteGoalSubTask}
                                onDeleteGoal={deleteFamilyGoal}
                            />
                        ) : currentView === 'eventPlanning' ? (
                            <EventPlanningView
                                events={events}
                                onAddEvent={addEvent}
                                onAddEventSection={addEventSection}
                                onAddEventItem={addEventItem}
                                onToggleEventItemCompletion={toggleEventItemCompletion}
                                onDeleteEvent={deleteEvent}
                                onDeleteEventSection={deleteEventSection}
                                onDeleteEventItem={deleteEventItem}
                            />
                        ) : currentView === 'lists' ? (
                            <ListsView
                                lists={lists}
                                onAddList={addList}
                                onAddListSection={addListSection}
                                onAddListItem={addListItem}
                                onToggleListItemCompletion={toggleListItemCompletion}
                                onDeleteList={deleteList}
                                onDeleteListSection={deleteListSection}
                                onDeleteListItem={deleteListItem}
                                shoppingListItems={shoppingListItems}
                                onAddShoppingListItem={addShoppingListItem}
                                onToggleShoppingListItemCompletion={toggleShoppingListItemCompletion}
                                onDeleteShoppingListItem={deleteShoppingListItem}
                            />
                        ) : currentView === 'budget' ? (
                            <FamilyBudgetView
                                transactions={transactions}
                                onAddTransaction={addTransaction}
                                onDeleteTransaction={deleteTransaction}
                                transactionType={transactionType}
                                setTransactionType={setTransactionType}
                                transactionAmount={transactionAmount}
                                setTransactionAmount={setTransactionAmount}
                                transactionCategory={transactionCategory}
                                setTransactionCategory={setTransactionCategory}
                                transactionDescription={transactionDescription}
                                setTransactionDescription={setTransactionDescription}
                                transactionDate={transactionDate}
                                setTransactionDate={setTransactionDate}
                                expenseCategories={expenseCategories}
                                incomeCategories={incomeCategories}
                                recurringIncome={recurringIncome}
                                setRecurringIncome={setRecurringIncome}
                                incomeFrequency={incomeFrequency}
                                setIncomeFrequency={setIncomeFrequency}
                                bills={bills}
                                addBill={addBill}
                                deleteBill={deleteBill}
                                newBillName={newBillName}
                                setNewBillName={setNewBillName}
                                newBillAmount={newBillAmount}
                                setNewBillAmount={setNewBillAmount}
                                newBillDueDate={newBillDueDate}
                                setNewBillDueDate={setNewBillDueDate}
                                newBillFrequency={newBillFrequency}
                                setNewBillFrequency={setNewBillFrequency}
                                calculationPeriod={calculationPeriod}
                                setCalculationPeriod={setCalculationPeriod}
                                calculateNetBalance={calculateNetBalance}
                                updateRecurringIncome={updateRecurringIncome}
                            />
                        ) : (
                            <FamilyCommunicationHubView
                                userId={userId}
                                messages={messages}
                                onAddMessage={addMessage}
                            />
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
                    </>
                )}
            </div>
        </div>
    );
};

export default App;
