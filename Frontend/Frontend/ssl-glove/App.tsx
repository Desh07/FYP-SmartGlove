import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  ActivityIndicator,
  Easing,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  updateProfile,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import * as Speech from 'expo-speech';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { auth } from './firebaseConfig';
import {
  getUserProfile,
  saveUserProfile,
  saveUserPhrases,
} from './data/firestoreService';
import {
  getCachedPhrases,
  getSettings,
  initLocalDb,
  insertGestureHistory,
  saveCachedPhrases,
  saveSettings,
} from './data/localDb';
import { useGloveData } from './hooks/useGloveData';
import { InferenceEngine, type CalibrationData } from './services/inference';
import { SentenceBuilder, translateSign } from './services/sentenceBuilder';
import { loadCalibration, saveCalibration } from './services/calibration';
import CalibrationScreen from './screens/CalibrationScreen';

// Load bundled model
const bundledModel = require('./assets/model.json');

type AuthScreen = 'login' | 'register';
type TabScreen = 'home' | 'language' | 'user';
type AppLanguage = 'English' | 'Sinhala' | 'Tamil';
type OutputLanguage = 'Sinhala' | 'Tamil';

const translations = {
  English: {
    loginToContinue: 'LOGIN TO CONTINUE',
    welcomeCommunity: 'WELCOME TO THE SMART GLOVE COMMUNITY',
    name: 'Name',
    email: 'Email',
    contactNumber: 'Contact number',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    rememberMe: 'Remember me',
    login: 'Login',
    register: 'Register',
    forgotPassword: 'Forgot Password?',
    continueWithGoogle: 'Continue with Google',
    signInWithGoogle: 'Sign in with Google',
    dontHaveAccount: "Don't have an account yet?",
    alreadyHaveAccount: 'Already have an account?',
    signup: 'Signup',
    loginLink: 'Login',
    welcome: 'Welcome',
    deviceStatus: 'Device Status',
    device: 'Device',
    connected: 'Connected',
    disconnected: 'Disconnected',
    disconnect: 'Disconnect',
    connect: 'Connect',
    savedPhrases: 'Saved Phrases',
    tutorials: 'Tutorials',
    setupGuide: 'Setup Guide',
    instructions: 'Instructions',
    howToWear: 'How to wear the glove',
    howGestureWorks: 'How gesture recognition works',
    faqs: 'FAQs',
    speakingForYou: 'Speaking for you...',
    playSample: 'Play sample',
    lastGesture: 'Last Recognized Gesture',
    detecting: 'Detecting...',
    selectLanguage: 'Language Preference',
    languageHelpSettings: 'Choose the language for recognized phrases.',
    languageOutputHint: 'Current gesture outputs will be in',
    userProfile: 'User Profile',
    profile: 'Profile',
    settings: 'Settings',
    voiceOutput: 'Voice output',
    hapticAlerts: 'Haptic alerts',
    darkMode: 'Dark mode',
    appLanguage: 'App language',
    languagePreferenceLabel: 'Language preference',
    output: 'Output',
    deviceSettings: 'Device Settings',
    changePhoto: 'Change photo',
    fullNamePlaceholder: 'Full name',
    emailPlaceholder: 'Email address',
    contactPlaceholder: 'Contact number',
    passwordPlaceholder: 'Enter your password',
    confirmPlaceholder: 'Confirm your password',
    namePlaceholder: 'Enter your name',
    saveChanges: 'Save changes',
    back: 'Back',
    menuSettings: 'Settings',
    menuProfile: 'Profile',
    menuDeviceSettings: 'Device settings',
    menuVoiceOutput: 'Voice output',
    menuTutorials: 'Tutorials',
    menuHelpSupport: 'Help & support',
    menuLogout: 'Log out',
    profileSaved: 'Changes saved.',
    resetTitle: 'Reset',
    resetMessage: 'Password reset flow goes here.',
    googleTitle: 'Google',
    googleMessage: 'Google auth flow goes here.',
    phrasesTitle: 'Phrases',
    phrasesMessage: 'Open all phrases.',
    profilePictureTitle: 'Profile Picture',
    profilePictureMessage: 'Add photo flow goes here.',
    addPhrase: 'Add phrase',
    newPhrasePlaceholder: 'Type a new phrase',
    editPhrase: 'Edit',
    deletePhrase: 'Delete',
    savePhrase: 'Save',
    edit: 'Edit',
    cancel: 'Cancel',
    voiceTitle: 'Voice',
    tutorialsTitle: 'Tutorials',
    helpTitle: 'Help',
    others: 'others',
    on: 'On',
    off: 'Off',
    tabHome: 'Home',
    tabLanguage: 'Language',
    tabUser: 'User',
  },
  Sinhala: {
    loginToContinue: 'ඇතුල් වීමට පුරනය වන්න',
    welcomeCommunity: 'ස්මාර්ට් ග්ලවු සමාජයට සාදරයෙන් පිළිගනිමු',
    name: 'නම',
    email: 'ඊමේල්',
    contactNumber: 'දුරකථන අංකය',
    password: 'මුරපදය',
    confirmPassword: 'මුරපදය තහවුරු කරන්න',
    rememberMe: 'මාව මතක තබාගන්න',
    login: 'පුරනය වන්න',
    register: 'ලියාපදිංචි වන්න',
    forgotPassword: 'මුරපදය අමතකද?',
    continueWithGoogle: 'Google සමඟ ඉදිරියට යන්න',
    signInWithGoogle: 'Google සමඟ ඇතුල් වන්න',
    dontHaveAccount: 'ගිණුමක් නැද්ද?',
    alreadyHaveAccount: 'දැනටමත් ගිණුමක් තිබේද?',
    signup: 'ලියාපදිංචි වන්න',
    loginLink: 'පුරනය වන්න',
    welcome: 'ආයුබෝවන්',
    deviceStatus: 'උපාංග තත්ත්වය',
    device: 'උපාංගය',
    connected: 'සම්බන්ධයි',
    disconnected: 'විසන්ධි',
    disconnect: 'විසන්ධි කරන්න',
    connect: 'සම්බන්ධ කරන්න',
    savedPhrases: 'සුරකින ලද වාක්ය',
    tutorials: 'නිර්දේශ',
    setupGuide: 'සකස් කිරීමේ මාර්ගෝපදේශය',
    instructions: 'උපදෙස්',
    howToWear: 'ග්ලවු පළඳින ආකාරය',
    howGestureWorks: 'අභිනය හඳුනාගැනීම ක්‍රියාත්මක වන්නේ මෙසේයි',
    faqs: 'නිතර අසන ප්‍රශ්න',
    speakingForYou: 'ඔබ වෙනුවෙන් කතා කරයි...',
    playSample: 'නිරූපණය ක්‍රියාත්මක කරන්න',
    lastGesture: 'අවසන් හඳුනාගත් අභිනය',
    detecting: 'හඳුනාගනිමින්...',
    selectLanguage: 'භාෂා මනාපය',
    languageHelpSettings: 'හඳුනාගත් වාක්‍ය සඳහා භාෂාව තෝරන්න.',
    languageOutputHint: 'දැනට හඳුනාගත් සைகා ප්‍රතිදාන ලැබෙන්නේ',
    userProfile: 'පරිශීලක පැතිකඩ',
    profile: 'පැතිකඩ',
    settings: 'සැකසුම්',
    voiceOutput: 'හඩ ප්‍රතිදානය',
    hapticAlerts: 'හපටික් දැනුම්දීම්',
    darkMode: 'අඳුරු ප්‍රකාරය',
    appLanguage: 'යෙදුම් භාෂාව',
    languagePreferenceLabel: 'භාෂා මනාපය',
    output: 'ප්‍රතිදානය',
    deviceSettings: 'උපාංග සැකසුම්',
    changePhoto: 'ඡායාරූපය වෙනස් කරන්න',
    fullNamePlaceholder: 'සම්පූර්ණ නම',
    emailPlaceholder: 'ඊමේල් ලිපිනය',
    contactPlaceholder: 'දුරකථන අංකය',
    passwordPlaceholder: 'මුරපදය ඇතුල් කරන්න',
    confirmPlaceholder: 'මුරපදය තහවුරු කරන්න',
    namePlaceholder: 'ඔබගේ නම ඇතුල් කරන්න',
    saveChanges: 'වෙනස්කම් සුරකින්න',
    back: 'ආපසු',
    menuSettings: 'සැකසුම්',
    menuProfile: 'පැතිකඩ',
    menuDeviceSettings: 'උපාංග සැකසුම්',
    menuVoiceOutput: 'හඩ ප්‍රතිදානය',
    menuTutorials: 'නිර්දේශ',
    menuHelpSupport: 'උදව් සහ සහාය',
    menuLogout: 'පිටවීම',
    profileSaved: 'වෙනස්කම් සුරකිණි.',
    resetTitle: 'නැවත සකසන්න',
    resetMessage: 'මුරපදය නැවත සකසන ක්‍රියාවලිය මෙහිදී ඇත.',
    googleTitle: 'Google',
    googleMessage: 'Google පුරනය කිරීම මෙහිදී ඇත.',
    phrasesTitle: 'වාක්‍ය',
    phrasesMessage: 'සියලු වාක්‍ය විවෘත කරන්න.',
    profilePictureTitle: 'පැතිකඩ ඡායාරූපය',
    profilePictureMessage: 'ඡායාරූපය එකතු කිරීම මෙහිදී ඇත.',
    addPhrase: 'වාක්‍ය එකතු කරන්න',
    newPhrasePlaceholder: 'නව වාක්‍යයක් ලියන්න',
    editPhrase: 'සංස්කරණය',
    deletePhrase: 'මකන්න',
    savePhrase: 'සුරකින්න',
    edit: 'සංස්කරණය කරන්න',
    cancel: 'අවලංගු කරන්න',
    voiceTitle: 'හඩ',
    tutorialsTitle: 'නිර්දේශ',
    helpTitle: 'උදව්',
    others: 'වෙනත්',
    on: 'සක්‍රිය',
    off: 'අක්‍රිය',
    tabHome: 'මුල් පිටුව',
    tabLanguage: 'භාෂාව',
    tabUser: 'පරිශීලක',
  },
  Tamil: {
    loginToContinue: 'தொடர உள்நுழைக',
    welcomeCommunity: 'ஸ்மார்ட் க்ளவ் சமூகத்திற்கு வரவேற்கிறோம்',
    name: 'பெயர்',
    email: 'மின்னஞ்சல்',
    contactNumber: 'தொடர்பு எண்',
    password: 'கடவுச்சொல்',
    confirmPassword: 'கடவுச்சொல்லை உறுதிப்படுத்தவும்',
    rememberMe: 'என்னை நினைவில் வைத்துக்கொள்ளவும்',
    login: 'உள்நுழைவு',
    register: 'பதிவு செய்யவும்',
    forgotPassword: 'கடவுச்சொல் மறந்துவிட்டதா?',
    continueWithGoogle: 'Google மூலம் தொடரவும்',
    signInWithGoogle: 'Google மூலம் உள்நுழைக',
    dontHaveAccount: 'கணக்கு இல்லையா?',
    alreadyHaveAccount: 'ஏற்கனவே கணக்கு உள்ளதா?',
    signup: 'பதிவு செய்யவும்',
    loginLink: 'உள்நுழைவு',
    welcome: 'வரவேற்கிறோம்',
    deviceStatus: 'சாதன நிலை',
    device: 'சாதனம்',
    connected: 'இணைக்கப்பட்டுள்ளது',
    disconnected: 'இணைப்பு இல்லை',
    disconnect: 'துண்டிக்கவும்',
    connect: 'இணைக்கவும்',
    savedPhrases: 'சேமித்த சொற்கள்',
    tutorials: 'பயிற்சிகள்',
    setupGuide: 'அமைப்பு வழிகாட்டி',
    instructions: 'வழிமுறைகள்',
    howToWear: 'க்ளவ் அணிவது எப்படி',
    howGestureWorks: 'சைகை அறிதல் எப்படி செயல்படுகிறது',
    faqs: 'அடிக்கடி கேட்கப்படும் கேள்விகள்',
    speakingForYou: 'உங்களுக்காக பேசுகிறது...',
    playSample: 'மாதிரி ஒலி',
    lastGesture: 'கடைசியாக கண்டறிந்த சைகை',
    detecting: 'கண்டறிகிறது...',
    selectLanguage: 'மொழி விருப்பம்',
    languageHelpSettings: 'அறியப்பட்ட சொற்களுக்கு மொழியைத் தேர்வு செய்யவும்.',
    languageOutputHint: 'தற்போதைய சைகை வெளியீடுகள் இருக்கும் மொழி',
    userProfile: 'பயனர் சுயவிவரம்',
    profile: 'சுயவிவரம்',
    settings: 'அமைப்புகள்',
    voiceOutput: 'குரல் வெளியீடு',
    hapticAlerts: 'ஹாப்டிக் அறிவிப்புகள்',
    darkMode: 'இருள் முறை',
    appLanguage: 'ஆப் மொழி',
    languagePreferenceLabel: 'மொழி விருப்பம்',
    output: 'வெளியீடு',
    deviceSettings: 'சாதன அமைப்புகள்',
    changePhoto: 'புகைப்படத்தை மாற்றவும்',
    fullNamePlaceholder: 'முழு பெயர்',
    emailPlaceholder: 'மின்னஞ்சல் முகவரி',
    contactPlaceholder: 'தொடர்பு எண்',
    passwordPlaceholder: 'கடவுச்சொல்லை உள்ளிடவும்',
    confirmPlaceholder: 'கடவுச்சொல்லை உறுதிப்படுத்தவும்',
    namePlaceholder: 'உங்கள் பெயரை உள்ளிடவும்',
    saveChanges: 'மாற்றங்களை சேமிக்கவும்',
    back: 'பின்செல்',
    menuSettings: 'அமைப்புகள்',
    menuProfile: 'சுயவிவரம்',
    menuDeviceSettings: 'சாதன அமைப்புகள்',
    menuVoiceOutput: 'குரல் வெளியீடு',
    menuTutorials: 'பயிற்சிகள்',
    menuHelpSupport: 'உதவி & ஆதரவு',
    menuLogout: 'வெளியேறு',
    profileSaved: 'மாற்றங்கள் சேமிக்கப்பட்டன.',
    resetTitle: 'மீளமை',
    resetMessage: 'கடவுச்சொல் மீளமைக்கும் பணிநடை இங்கே உள்ளது.',
    googleTitle: 'Google',
    googleMessage: 'Google உள்நுழைவு இங்கே உள்ளது.',
    phrasesTitle: 'சொற்கள்',
    phrasesMessage: 'அனைத்து சொற்களையும் திறக்கவும்.',
    profilePictureTitle: 'சுயவிவர புகைப்படம்',
    profilePictureMessage: 'புகைப்படம் சேர்க்கும் செயல்முறை இங்கே உள்ளது.',
    addPhrase: 'சொல்லை சேர்க்கவும்',
    newPhrasePlaceholder: 'புதிய சொல்லை எழுதவும்',
    editPhrase: 'திருத்து',
    deletePhrase: 'நீக்கு',
    savePhrase: 'சேமி',
    edit: 'திருத்தவும்',
    cancel: 'ரத்து செய்',
    voiceTitle: 'குரல்',
    tutorialsTitle: 'பயிற்சிகள்',
    helpTitle: 'உதவி',
    others: 'மற்றவை',
    on: 'இயக்கு',
    off: 'நிறுத்து',
    tabHome: 'முகப்பு',
    tabLanguage: 'மொழி',
    tabUser: 'பயனர்',
  },
} as const;

type TranslationKey = keyof typeof translations.English;

const appLanguageOptions: { key: AppLanguage; label: string }[] = [
  { key: 'English', label: 'English' },
  { key: 'Sinhala', label: 'සිංහල' },
  { key: 'Tamil', label: 'தமிழ்' },
];

const outputLanguageOptions: { key: OutputLanguage; label: string }[] = [
  { key: 'Sinhala', label: 'සිංහල' },
  { key: 'Tamil', label: 'தமிழ்' },
];

const defaultSavedPhrases: Record<OutputLanguage, string[]> = {
  Sinhala: [
    'මට උදව් අවශ්‍යයි',
    'කරුණාකර ඉන්න',
    'ජලය දෙන්න',
    'මට වේදනායි',
    'මෙතනට එන්න',
  ],
  Tamil: [
    'எனக்கு உதவி வேண்டும்',
    'தயவு செய்து காத்திருக்கவும்',
    'தண்ணீர் கொடுங்கள்',
    'எனக்கு வலி',
    'இங்கே வாருங்கள்',
  ],
};

const tutorialSteps = [
  {
    title: 'Wear the glove',
    body: 'Slide your hand in and secure the straps so the sensors sit flat.',
    image: require('./assets/tutorials/step-1.jpg'),
  },
  {
    title: 'Turn on the device',
    body: 'Press the power button and wait for the status light to turn on.',
    image: require('./assets/tutorials/step-2.jpeg'),
  },
  {
    title: 'Connect to Bluetooth',
    body: 'Enable Bluetooth and connect to the SSL Glove from the app.',
    image: require('./assets/tutorials/step-3.jpeg'),
  },
  {
    title: 'Make hand gestures',
    body: 'Try the supported gestures clearly so the app can recognize them.',
    image: require('./assets/tutorials/step-4.jpeg'),
  },
  {
    title: 'Start translating',
    body: 'The app speaks your gesture in the selected output language.',
    image: require('./assets/tutorials/step-5.jpeg'),
  },
];

const getText = (language: AppLanguage, key: TranslationKey) =>
  translations[language][key] ?? translations.English[key];

const lightPalette = {
  red: '#EE3E42',
  redDark: '#D7373A',
  lavender: '#F1EEE9',
  lavenderDeep: '#E2DDD6',
  ink: '#1F1C18',
  muted: '#6F6B65',
  soft: '#F7F4EE',
  white: '#FFFCF7',
  success: '#2BB673',
  border: '#E2DDD6',
  overlay: 'rgba(255, 255, 255, 0.7)',
};
const darkPalette = {
  red: '#EE3E42',
  redDark: '#B83437',
  lavender: '#1F1A16',
  lavenderDeep: '#2B2520',
  ink: '#F4EFE8',
  muted: '#C2B9AE',
  soft: '#151210',
  white: '#1B1713',
  success: '#2BB673',
  border: '#2E2722',
  overlay: 'rgba(0, 0, 0, 0.45)',
};
type ThemePalette = typeof lightPalette;

const googleIcon = require('./assets/google.png');
const bluetoothIcon = require('./assets/bluetooth.png');
const HAS_LAUNCHED_KEY = 'ssl_glove_has_launched';

// Validation utilities
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password: string): { valid: boolean; message: string } => {
  if (password.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters' };
  }
  return { valid: true, message: '' };
};

const getAuthErrorMessage = (error: any): string => {
  const errorCode = error?.code || '';
  if (errorCode === 'auth/user-not-found') {
    return 'No account found with this email address';
  }
  if (errorCode === 'auth/wrong-password') {
    return 'Incorrect password. Please try again';
  }
  if (errorCode === 'auth/invalid-email') {
    return 'Invalid email address';
  }
  if (errorCode === 'auth/email-already-in-use') {
    return 'This email is already registered';
  }
  if (errorCode === 'auth/weak-password') {
    return 'Password is too weak';
  }
  if (errorCode === 'auth/too-many-requests') {
    return 'Too many login attempts. Please try again later';
  }
  return 'Authentication failed. Please try again';
};

export default function App() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
  const [activeTab, setActiveTab] = useState<TabScreen>('home');
  const [appLanguage, setAppLanguage] = useState<AppLanguage>('English');
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>('Sinhala');
  const [lastGesture, setLastGesture] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileScreenOpen, setProfileScreenOpen] = useState(false);
  const [deviceScreenOpen, setDeviceScreenOpen] = useState(false);
  const [savedPhrasesOpen, setSavedPhrasesOpen] = useState(false);
  const [tutorialsOpen, setTutorialsOpen] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [liveReaderOpen, setLiveReaderOpen] = useState(false);
  const [calibratorOpen, setCalibratorOpen] = useState(false);

  // ─── BLE + Inference Integration ───
  const glove = useGloveData();
  const inferenceRef = useRef(new InferenceEngine());
  const sentenceRef = useRef(new SentenceBuilder());
  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [sentenceWords, setSentenceWords] = useState<string[]>([]);
  const [confidence, setConfidence] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0);
  const [topPredictions, setTopPredictions] = useState<{label: string; probability: number}[]>([]);

  // Load model on mount
  useEffect(() => {
    try {
      inferenceRef.current.loadModel(bundledModel);
      setModelLoaded(true);
    } catch (err) {
      console.error('Failed to load model:', err);
    }
  }, []);

  // Load calibration from storage
  useEffect(() => {
    loadCalibration().then(cal => {
      if (cal) setCalibrationData(cal);
    });
  }, []);

  // Run inference when sensor data arrives
  useEffect(() => {
    if (!glove.sensorData || !modelLoaded) return;

    const result = inferenceRef.current.predict(
      glove.sensorData.flex,
      glove.sensorData.imu,
      calibrationData,
      'right'
    );

    if (result) {
      // Determine language code for translation
      const langCode = outputLanguage === 'Tamil' ? 'ta' : 'si';
      setLastGesture(translateSign(result.sign, langCode));
      setConfidence(result.confidence);
      setTopPredictions(result.top5);

      // Update sentence builder
      const added = sentenceRef.current.update(result.sign, result.confidence, result.isStill);
      const state = sentenceRef.current.getState();
      setSentenceWords(state.words);
      setHoldProgress(state.holdProgress);

      if (added) {
        // Speak the word if voice output is on
        const langSpeech = outputLanguage === 'Tamil' ? 'ta-IN' : 'si-LK';
        const translated = translateSign(result.sign, langCode);
        Speech.speak(translated, { language: langSpeech, rate: 0.9 });
      }
    }
  }, [glove.sensorData, modelLoaded, calibrationData, outputLanguage]);

  // Wrap BLE connection state as isConnected for the rest of the app
  const isConnected = glove.isConnected;
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);
  const [errorToast, setErrorToast] = useState<{ title: string; message: string } | null>(
    null
  );

  // Show BLE scan or connection error if it happens
  useEffect(() => {
    if (glove.error) {
      showError('Glove Connection', glove.error);
    }
  }, [glove.error]);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('user@example.com');
  const [profilePhone, setProfilePhone] = useState('+94 77 123 4567');
  const [profileDevice, setProfileDevice] = useState('SSL Glove 01');
  const [voiceOutputOn, setVoiceOutputOn] = useState(true);
  const [hapticAlertsOn, setHapticAlertsOn] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [savedPhrases, setSavedPhrases] = useState<Record<OutputLanguage, string[]>>(
    defaultSavedPhrases
  );
  const [profileSaved, setProfileSaved] = useState({
    name: '',
    email: 'user@example.com',
    phone: '+94 77 123 4567',
    device: 'SSL Glove 01',
  });
  const [profileInitInProgress, setProfileInitInProgress] = useState(false);
  const menuAnim = useRef(new Animated.Value(0)).current;
  const resolvedProfileName = useMemo(() => {
    const currentName = profileName?.trim();
    const savedName = profileSaved.name?.trim();
    const authName = auth.currentUser?.displayName?.trim();
    const emailName = auth.currentUser?.email
      ? auth.currentUser.email.split('@')[0]
      : '';
    return currentName || savedName || authName || emailName || '';
  }, [profileName, profileSaved.name]);

  const statusText = useMemo(
    () => {
      if (glove.connectionState === 'scanning') return 'Scanning...';
      if (glove.connectionState === 'connecting') return 'Connecting...';
      if (isConnected) return getText(appLanguage, 'connected');
      return getText(appLanguage, 'disconnected');
    },
    [isConnected, appLanguage, glove.connectionState]
  );

  const themePalette = useMemo(
    () => (isDarkMode ? darkPalette : lightPalette),
    [isDarkMode]
  );
  const themeStyles = useMemo(() => createStyles(themePalette), [themePalette]);
  const themeValue = useMemo(
    () => ({ palette: themePalette, styles: themeStyles, isDark: isDarkMode }),
    [themePalette, themeStyles, isDarkMode]
  );

  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), 1400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOnline(Boolean(state.isConnected));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadLocalState = async () => {
      try {
        await initLocalDb();
        const settings = await getSettings();
        if (isMounted) {
          if (settings.appLanguage) {
            setAppLanguage(settings.appLanguage as AppLanguage);
          }
          if (settings.outputLanguage) {
            setOutputLanguage(settings.outputLanguage as OutputLanguage);
          }
          if (settings.voiceOutputOn) {
            setVoiceOutputOn(settings.voiceOutputOn === 'true');
          }
          if (settings.hapticAlertsOn) {
            setHapticAlertsOn(settings.hapticAlertsOn === 'true');
          }
          if (settings.darkMode) {
            setIsDarkMode(settings.darkMode === 'true');
          }
        }

        const cachedPhrases = await getCachedPhrases();
        if (isMounted && Object.keys(cachedPhrases).length > 0) {
          setSavedPhrases((prev) => ({
            ...prev,
            ...cachedPhrases,
          }));
        }
      } catch (error) {
        // Keep defaults if local DB fails.
      }
    };

    loadLocalState();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadLaunchFlag = async () => {
      try {
        const value = await AsyncStorage.getItem(HAS_LAUNCHED_KEY);
        if (isMounted) {
          setIsFirstLaunch(value !== 'true');
        }
      } catch (error) {
        if (isMounted) {
          setIsFirstLaunch(true);
        }
      }
    };

    loadLaunchFlag();
    return () => {
      isMounted = false;
    };
  }, []);

  const showError = (title: string, message: string) => {
    setErrorToast({ title, message });
  };

  useEffect(() => {
    saveSettings({
      appLanguage,
      outputLanguage,
      voiceOutputOn: String(voiceOutputOn),
      hapticAlertsOn: String(hapticAlertsOn),
      darkMode: String(isDarkMode),
    }).catch(() => {});
  }, [appLanguage, outputLanguage, voiceOutputOn, hapticAlertsOn, isDarkMode]);

  useEffect(() => {
    saveCachedPhrases(savedPhrases).catch(() => {});
  }, [savedPhrases]);

  useEffect(() => {
    if (!lastGesture) {
      return;
    }
    const detectingLabel = getText(appLanguage, 'detecting');
    if (lastGesture === detectingLabel) {
      return;
    }
    insertGestureHistory(outputLanguage, lastGesture).catch(() => {});
  }, [appLanguage, lastGesture, outputLanguage]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !isAuthed || !isOnline) {
      return;
    }
    saveUserPhrases(uid, savedPhrases).catch(() => {});
  }, [isAuthed, isOnline, savedPhrases]);

  const styles = themeStyles;

  const completeFirstLaunch = async (nextScreen: AuthScreen) => {
    try {
      await AsyncStorage.setItem(HAS_LAUNCHED_KEY, 'true');
    } catch (error) {
      // Non-blocking: continue even if storage fails.
    }
    setIsFirstLaunch(false);
    setAuthScreen(nextScreen);
  };

  useEffect(() => {
    setAuthChecking(true);
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      let fallbackName = '';
      try {
        if (!user) {
          setIsAuthed(false);
          return;
        }

        setIsAuthed(true);
        fallbackName =
          user.displayName ?? (user.email ? user.email.split('@')[0] : '');
        const profileData = await getUserProfile(user.uid);
        if (profileData) {
          const data = profileData;
          const cleanedName =
            typeof data?.name === 'string' ? data.name.trim() : '';
          const resolvedName = cleanedName || fallbackName;
          const nextProfile = {
            name: resolvedName,
            email: data?.email ?? user.email ?? 'user@example.com',
            phone: data?.phone ?? '+94 77 123 4567',
            device: data?.device ?? 'SSL Glove 01',
          };
          setProfileName(resolvedName);
          setProfileEmail(nextProfile.email);
          setProfilePhone(nextProfile.phone);
          setProfileDevice(nextProfile.device);
          setProfileSaved(nextProfile);
        } else {
          const resolvedName = fallbackName.trim();
          const nextProfile = {
            name: resolvedName,
            email: user.email ?? 'user@example.com',
            phone: profilePhone || '+94 77 123 4567',
            device: profileDevice || 'SSL Glove 01',
          };
          if (!profileInitInProgress) {
            await saveUserProfile(user.uid, nextProfile);
          }
          setProfileName((prev) => prev || resolvedName);
          setProfileEmail(nextProfile.email);
          setProfilePhone(nextProfile.phone);
          setProfileDevice(nextProfile.device);
          setProfileSaved(nextProfile);
        }
      } catch (error) {
        const resolvedName = fallbackName.trim();
        setProfileName((prev) => prev || resolvedName);
        setProfileSaved((prev) => ({
          ...prev,
          name: resolvedName,
          email: user?.email ?? prev.email,
        }));
        showError('Firebase', 'Unable to load profile data.');
      } finally {
        setAuthChecking(false);
      }
    });

    return unsubscribe;
  }, []);

  const handleLogin = async (email: string, password: string) => {
    if (authLoading) {
      return;
    }
    if (!email || !password) {
      showError('Login', 'Please enter email and password.');
      return;
    }
    if (!validateEmail(email)) {
      showError('Login', 'Please enter a valid email address');
      return;
    }
    try {
      setAuthLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      const message = getAuthErrorMessage(error);
      showError('Login Failed', message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (
    name: string,
    email: string,
    phone: string,
    password: string,
    confirmPassword: string
  ) => {
    if (authLoading) {
      return;
    }
    // Validation checks
    if (!name || !email || !password || !confirmPassword) {
      showError('Registration', 'Please fill in all required fields.');
      return;
    }
    if (!validateEmail(email)) {
      showError('Registration', 'Please enter a valid email address');
      return;
    }
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      showError('Registration', passwordValidation.message);
      return;
    }
    if (password !== confirmPassword) {
      showError('Registration', 'Passwords do not match');
      return;
    }
    try {
      setProfileInitInProgress(true);
      setAuthLoading(true);
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      if (credential.user) {
        await updateProfile(credential.user, { displayName: name });
      }
      const profile = {
        name,
        email: email.trim(),
        phone,
        device: 'SSL Glove 01',
      };
      await saveUserProfile(credential.user.uid, profile);
      setProfileName(profile.name);
      setProfileEmail(profile.email);
      setProfilePhone(profile.phone || '+94 77 123 4567');
      setProfileDevice(profile.device);
      setProfileSaved(profile);
      setActiveTab('home');
      setProfileScreenOpen(false);
      setDeviceScreenOpen(false);
      setSavedPhrasesOpen(false);
      setMenuOpen(false);
    } catch (error) {
      const message = getAuthErrorMessage(error);
      showError('Registration Failed', message);
    } finally {
      setProfileInitInProgress(false);
      setAuthLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        showError('Error', 'No authenticated user found');
        return;
      }
      const profile = {
        name: profileName,
        email: profileEmail,
        phone: profilePhone,
        device: profileDevice,
      };
      await saveUserProfile(user.uid, profile);
      setProfileSaved(profile);
      Alert.alert('Success', getText(appLanguage, 'profileSaved'));
    } catch (error) {
      showError('Error', 'Unable to save profile changes');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      showError('Logout', 'Unable to log out.');
    } finally {
      setIsAuthed(false);
      setAuthScreen('login');
      setProfileName('');
      setProfileEmail('user@example.com');
      setProfilePhone('+94 77 123 4567');
      setProfileDevice('SSL Glove 01');
      setProfileSaved({
        name: '',
        email: 'user@example.com',
        phone: '+94 77 123 4567',
        device: 'SSL Glove 01',
      });
    }
  };

  const toggleMenu = (open: boolean) => {
    setMenuOpen(open);
    Animated.timing(menuAnim, {
      toValue: open ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };

  const openProfileFromMenu = () => {
    toggleMenu(false);
    setDeviceScreenOpen(false);
    setSavedPhrasesOpen(false);
    setActiveTab('home');
    setProfileScreenOpen(true);
  };

  const openDeviceSettingsFromMenu = () => {
    toggleMenu(false);
    setProfileScreenOpen(false);
    setSavedPhrasesOpen(false);
    setTutorialsOpen(false);
    setActiveTab('home');
    setDeviceScreenOpen(true);
  };

  const closeOverlayScreen = () => {
    setProfileScreenOpen(false);
    setDeviceScreenOpen(false);
    setSavedPhrasesOpen(false);
    setTutorialsOpen(false);
    setLiveReaderOpen(false);
    setCalibratorOpen(false);
    setActiveTab('home');
  };

  const openLiveReader = () => {
    toggleMenu(false);
    setProfileScreenOpen(false);
    setDeviceScreenOpen(false);
    setSavedPhrasesOpen(false);
    setTutorialsOpen(false);
    setActiveTab('home');
    setLiveReaderOpen(true);
  };

  const openCalibrator = () => {
    toggleMenu(false);
    setProfileScreenOpen(false);
    setDeviceScreenOpen(false);
    setSavedPhrasesOpen(false);
    setTutorialsOpen(false);
    setLiveReaderOpen(false);
    setActiveTab('home');
    setCalibratorOpen(true);
  };

  const handleOutputLanguageChange = (value: OutputLanguage) => {
    setOutputLanguage(value);
    setLastGesture(getGestureSample(value));
  };

  const openSavedPhrases = () => {
    setProfileScreenOpen(false);
    setDeviceScreenOpen(false);
    setTutorialsOpen(false);
    setActiveTab('home');
    setSavedPhrasesOpen(true);
  };

  const closeSavedPhrases = () => {
    setSavedPhrasesOpen(false);
  };

  const openTutorials = () => {
    toggleMenu(false);
    setProfileScreenOpen(false);
    setDeviceScreenOpen(false);
    setSavedPhrasesOpen(false);
    setActiveTab('home');
    setTutorialsOpen(true);
  };

  const handleAddPhrase = (phrase: string) => {
    const trimmed = phrase.trim();
    if (!trimmed) {
      return;
    }
    setSavedPhrases((prev) => ({
      ...prev,
      [outputLanguage]: [...prev[outputLanguage], trimmed],
    }));
  };

  const handleUpdatePhrase = (index: number, phrase: string) => {
    const trimmed = phrase.trim();
    if (!trimmed) {
      return;
    }
    setSavedPhrases((prev) => ({
      ...prev,
      [outputLanguage]: prev[outputLanguage].map((item, idx) =>
        idx === index ? trimmed : item
      ),
    }));
  };

  const handleRemovePhrase = (index: number) => {
    setSavedPhrases((prev) => ({
      ...prev,
      [outputLanguage]: prev[outputLanguage].filter((_, idx) => idx !== index),
    }));
  };

  const speakPhrase = (text: string, language: OutputLanguage) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    Speech.stop();
    Speech.speak(trimmed, {
      language: language === 'Sinhala' ? 'si-LK' : 'ta-IN',
      rate: 0.9,
      pitch: 1.0,
    });
  };

  const showStartup = authChecking || !splashDone || isFirstLaunch === null;
  let content: React.ReactElement;

  if (showStartup) {
    content = <SplashScreen />;
  } else if (!isAuthed && isFirstLaunch) {
    content = (
      <FirstTimeScreen
        onRegister={() => completeFirstLaunch('register')}
        onLogin={() => completeFirstLaunch('login')}
      />
    );
  } else if (!isAuthed) {
    content =
      authScreen === 'login' ? (
        <LoginScreen
          appLanguage={appLanguage}
          onLogin={handleLogin}
          onGoRegister={() => setAuthScreen('register')}
          isLoading={authLoading}
          errorToast={errorToast}
          onHideError={() => setErrorToast(null)}
        />
      ) : (
        <RegisterScreen
          appLanguage={appLanguage}
          onRegister={handleRegister}
          onGoLogin={() => setAuthScreen('login')}
          isLoading={authLoading}
          errorToast={errorToast}
          onHideError={() => setErrorToast(null)}
        />
      );
  } else {
    content = (
      <SafeAreaView style={styles.appContainer}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <ErrorToast toast={errorToast} onHide={() => setErrorToast(null)} />
        <Header onMenu={() => toggleMenu(true)} />
        {liveReaderOpen ? (
          <LiveSignReaderScreen
            appLanguage={appLanguage}
            outputLanguage={outputLanguage}
            isConnected={isConnected}
            onToggleConnection={() => {
              if (isConnected) {
                glove.disconnect();
              } else {
                glove.scan();
              }
            }}
            connectionState={glove.connectionState}
            lastGesture={lastGesture}
            confidence={confidence}
            sentenceWords={sentenceWords}
            holdProgress={holdProgress}
            topPredictions={topPredictions}
            sps={glove.sps}
            modelLoaded={modelLoaded}
            onSpeak={() => {
              const langCode = outputLanguage === 'Tamil' ? 'ta' : 'si';
              const text = sentenceRef.current.getSentenceText(langCode);
              if (text) {
                Speech.speak(text, {
                  language: outputLanguage === 'Tamil' ? 'ta-IN' : 'si-LK',
                  rate: 0.9,
                });
              }
            }}
            onClearSentence={() => {
              sentenceRef.current.clear();
              setSentenceWords([]);
            }}
            onUndoWord={() => {
              sentenceRef.current.undo();
              setSentenceWords(sentenceRef.current.getState().words);
            }}
            onClose={closeOverlayScreen}
          />
        ) : calibratorOpen ? (
          <CalibrationScreen
            appLanguage={appLanguage}
            sensorData={glove.sensorData}
            isConnected={isConnected}
            existingCalibration={calibrationData}
            onSaveCalibration={(cal) => {
              setCalibrationData(cal);
              saveCalibration(cal);
              setCalibratorOpen(false);
            }}
            onClose={closeOverlayScreen}
            palette={themePalette}
            baseStyles={themeStyles}
          />
        ) : savedPhrasesOpen ? (
          <SavedPhrasesScreen
            appLanguage={appLanguage}
            outputLanguage={outputLanguage}
            phrases={savedPhrases[outputLanguage]}
            onSpeak={(text) => speakPhrase(text, outputLanguage)}
            onAddPhrase={handleAddPhrase}
            onUpdatePhrase={handleUpdatePhrase}
            onRemovePhrase={handleRemovePhrase}
            onChangeOutputLanguage={handleOutputLanguageChange}
            onClose={closeSavedPhrases}
          />
        ) : tutorialsOpen ? (
          <TutorialsScreen appLanguage={appLanguage} onClose={closeOverlayScreen} />
        ) : profileScreenOpen ? (
          <ProfileScreen
            appLanguage={appLanguage}
            name={profileName}
            email={profileEmail}
            phone={profilePhone}
            device={profileDevice}
            saved={profileSaved}
            onChangeName={setProfileName}
            onChangeEmail={setProfileEmail}
            onChangePhone={setProfilePhone}
            onChangeDevice={setProfileDevice}
            onSave={() => {
              const user = auth.currentUser;
              if (!user) {
                showError('Profile', 'Please sign in again.');
                return;
              }
              const payload = {
                name: profileName,
                email: profileEmail,
                phone: profilePhone,
                device: profileDevice,
              };
              saveUserProfile(user.uid, payload)
                .then(() => {
                  setProfileSaved(payload);
                  Alert.alert(
                    getText(appLanguage, 'profile'),
                    getText(appLanguage, 'profileSaved')
                  );
                })
                .catch(() => {
                  showError('Profile', 'Unable to save changes.');
                });
            }}
            onClose={closeOverlayScreen}
          />
        ) : deviceScreenOpen ? (
          <DeviceSettingsScreen
            appLanguage={appLanguage}
            voiceOutputOn={voiceOutputOn}
            hapticAlertsOn={hapticAlertsOn}
            isDarkMode={isDarkMode}
            selectedLanguage={appLanguage}
            onToggleVoice={() => setVoiceOutputOn((prev) => !prev)}
            onToggleHaptics={() => setHapticAlertsOn((prev) => !prev)}
            onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
            onChangeLanguage={setAppLanguage}
            onClose={closeOverlayScreen}
          />
        ) : (
          <>
            {activeTab === 'home' && (
              <HomeScreen
                statusText={statusText}
                isConnected={isConnected}
                onToggleConnection={() => {
                  if (isConnected) {
                    glove.disconnect();
                  } else {
                    glove.scan();
                  }
                }}
                lastGesture={lastGesture || getText(appLanguage, 'detecting')}
                onGestureSample={() =>
                  setLastGesture(getGestureSample(outputLanguage))
                }
                userName={resolvedProfileName}
                phrases={savedPhrases[outputLanguage]}
                onOpenSavedPhrases={openSavedPhrases}
                onOpenTutorials={openTutorials}
                onOpenLiveReader={openLiveReader}
                appLanguage={appLanguage}
                outputLanguage={outputLanguage}
              />
            )}
            {activeTab === 'language' && (
              <LanguageScreen
                appLanguage={appLanguage}
                outputLanguage={outputLanguage}
                onChangeOutputLanguage={handleOutputLanguageChange}
              />
            )}
            {activeTab === 'user' && (
              <UserScreen
                appLanguage={appLanguage}
                profileName={profileName}
                profileDevice={profileDevice}
                profileEmail={profileEmail}
                profilePhone={profilePhone}
                voiceOutputOn={voiceOutputOn}
                hapticAlertsOn={hapticAlertsOn}
                outputLanguage={outputLanguage}
                onLogout={handleLogout}
              />
            )}
            <TabBar
              activeTab={activeTab}
              onChange={setActiveTab}
              appLanguage={appLanguage}
            />
          </>
        )}
        <SlideMenu
          open={menuOpen}
          anim={menuAnim}
          onClose={() => toggleMenu(false)}
          appLanguage={appLanguage}
          onOpenProfile={openProfileFromMenu}
          onOpenDeviceSettings={openDeviceSettingsFromMenu}
          onOpenTutorials={openTutorials}
          onOpenLiveReader={openLiveReader}
          onOpenCalibrator={openCalibrator}
          onLogout={() => {
            toggleMenu(false);
            handleLogout();
          }}
        />
      </SafeAreaView>
    );
  }
  return <ThemeContext.Provider value={themeValue}>{content}</ThemeContext.Provider>;
}

function SplashScreen() {
  const styles = useThemedStyles();
  const { isDark } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [float, pulse]);

  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });
  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.65, 1],
  });
  const floatY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  return (
    <SafeAreaView style={styles.splashContainer}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.splashBackground}>
        <View style={styles.splashOrb} />
        <View style={styles.splashOrbTwo} />
      </View>
      <Animated.View
        style={[styles.splashCard, { transform: [{ translateY: floatY }] }]}
      >
        <Animated.View
          style={[
            styles.splashLogo,
            { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
          ]}
        >
          <Text style={styles.splashLogoText}>SSL</Text>
        </Animated.View>
        <Text style={styles.splashTitle}>GLOVE</Text>
        <Text style={styles.splashSubtitle}>Smart glove companion</Text>
        <View style={styles.splashLoaderRow}>
          <LoadingDots />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

function FirstTimeScreen({
  onRegister,
  onLogin,
}: {
  onRegister: () => void;
  onLogin: () => void;
}) {
  const styles = useThemedStyles();
  const { isDark } = useTheme();
  return (
    <SafeAreaView style={styles.firstTimeContainer}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.firstTimeBackground}>
        <View style={styles.firstTimeOrb} />
        <View style={styles.firstTimeOrbTwo} />
      </View>
      <View style={styles.firstTimeCard}>
        <Text style={styles.firstTimeEyebrow}>WELCOME</Text>
        <Text style={styles.firstTimeTitle}>Meet SSL Glove</Text>
        <Text style={styles.firstTimeSubtitle}>
          Translate gestures into natural speech and build your personal phrase bank.
        </Text>
        <View style={styles.firstTimeBadgeRow}>
          <View style={styles.firstTimeBadge}>
            <Text style={styles.firstTimeBadgeText}>Fast setup</Text>
          </View>
          <View style={styles.firstTimeBadge}>
            <Text style={styles.firstTimeBadgeText}>Voice output</Text>
          </View>
        </View>
        <Pressable style={styles.firstTimePrimary} onPress={onRegister}>
          <Text style={styles.firstTimePrimaryText}>Create account</Text>
        </Pressable>
        <Pressable style={styles.firstTimeSecondary} onPress={onLogin}>
          <Text style={styles.firstTimeSecondaryText}>I already have an account</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function getGestureSample(language: OutputLanguage) {
  switch (language) {
    case 'Tamil':
      return 'நீங்கள் எப்படி இருக்கிறீர்கள்?';
    case 'Sinhala':
      return 'ඔබට කොහොමද?';
  }
}

function Header({ onMenu }: { onMenu: () => void }) {
  const styles = useThemedStyles();
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.brandTop}>SSL</Text>
        <Text style={styles.brandBottom}>GLOVE</Text>
      </View>
      <Pressable onPress={onMenu} style={styles.menuButton}>
        <View style={styles.menuLines}>
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
        </View>
      </Pressable>
    </View>
  );
}

function LoginScreen({
  appLanguage,
  onLogin,
  onGoRegister,
  isLoading,
  errorToast,
  onHideError,
}: {
  appLanguage: AppLanguage;
  onLogin: (email: string, password: string) => void;
  onGoRegister: () => void;
  isLoading: boolean;
  errorToast: { title: string; message: string } | null;
  onHideError: () => void;
}) {
  const styles = useThemedStyles();
  const { palette, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <SafeAreaView style={styles.authContainer}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ErrorToast toast={errorToast} onHide={onHideError} />
      <ScrollView contentContainerStyle={styles.authContent}>
        <View style={styles.authBrandRow}>
          <Text style={styles.authBrand}>SSL</Text>
          <Text style={[styles.authBrand, styles.authBrandAccent]}>GLOVE</Text>
        </View>
        <Text style={styles.authSubtitle}>
          {getText(appLanguage, 'loginToContinue')}
        </Text>

        <Text style={styles.inputLabel}>{getText(appLanguage, 'email')}</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={getText(appLanguage, 'emailPlaceholder')}
          placeholderTextColor={palette.muted}
          style={styles.input}
          keyboardType="email-address"
          editable={!isLoading}
        />

        <Text style={styles.inputLabel}>{getText(appLanguage, 'password')}</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={getText(appLanguage, 'passwordPlaceholder')}
          placeholderTextColor={palette.muted}
          style={styles.input}
          secureTextEntry
          editable={!isLoading}
        />

        <Pressable
          disabled={isLoading}
          onPress={() =>
            Alert.alert(
              getText(appLanguage, 'resetTitle'),
              getText(appLanguage, 'resetMessage')
            )
          }
        >
          <Text style={styles.forgotText}>
            {getText(appLanguage, 'forgotPassword')}
          </Text>
        </Pressable>

        <PrimaryButton
          label={getText(appLanguage, 'login')}
          onPress={() => onLogin(email, password)}
          isLoading={isLoading}
          disabled={isLoading}
        />
        <OutlineButton
          label={getText(appLanguage, 'continueWithGoogle')}
          onPress={() =>
            Alert.alert(
              getText(appLanguage, 'googleTitle'),
              getText(appLanguage, 'googleMessage')
            )
          }
          icon={googleIcon}
          disabled={isLoading}
        />

        <Pressable onPress={isLoading ? undefined : onGoRegister} disabled={isLoading}>
          <Text style={styles.authFooter}>
            {getText(appLanguage, 'dontHaveAccount')}{' '}
            <Text style={styles.linkText}>
              {getText(appLanguage, 'signup')}
            </Text>
          </Text>
        </Pressable>
      </ScrollView>
      <LoadingOverlay visible={isLoading} />
    </SafeAreaView>
  );
}

function RegisterScreen({
  appLanguage,
  onRegister,
  onGoLogin,
  isLoading,
  errorToast,
  onHideError,
}: {
  appLanguage: AppLanguage;
  onRegister: (name: string, email: string, phone: string, password: string, confirmPassword: string) => void;
  onGoLogin: () => void;
  isLoading: boolean;
  errorToast: { title: string; message: string } | null;
  onHideError: () => void;
}) {
  const styles = useThemedStyles();
  const { palette, isDark } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  return (
    <SafeAreaView style={styles.authContainer}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ErrorToast toast={errorToast} onHide={onHideError} />
      <ScrollView contentContainerStyle={styles.authContent}>
        <View style={styles.authBrandRow}>
          <Text style={styles.authBrand}>SSL</Text>
          <Text style={[styles.authBrand, styles.authBrandAccent]}>GLOVE</Text>
        </View>
        <Text style={styles.authSubtitle}>
          {getText(appLanguage, 'welcomeCommunity')}
        </Text>

        <Text style={styles.inputLabel}>{getText(appLanguage, 'name')}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={getText(appLanguage, 'namePlaceholder')}
          placeholderTextColor={palette.muted}
          style={styles.input}
          editable={!isLoading}
        />

        <Text style={styles.inputLabel}>{getText(appLanguage, 'email')}</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={getText(appLanguage, 'emailPlaceholder')}
          placeholderTextColor={palette.muted}
          style={styles.input}
          keyboardType="email-address"
          editable={!isLoading}
        />

        <Text style={styles.inputLabel}>
          {getText(appLanguage, 'contactNumber')}
        </Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder={getText(appLanguage, 'contactPlaceholder')}
          placeholderTextColor={palette.muted}
          style={styles.input}
          keyboardType="phone-pad"
          editable={!isLoading}
        />

        <Text style={styles.inputLabel}>{getText(appLanguage, 'password')}</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={getText(appLanguage, 'passwordPlaceholder')}
          placeholderTextColor={palette.muted}
          style={styles.input}
          secureTextEntry
          editable={!isLoading}
        />

        <Text style={styles.inputLabel}>
          {getText(appLanguage, 'confirmPassword')}
        </Text>
        <TextInput
          value={confirm}
          onChangeText={setConfirm}
          placeholder={getText(appLanguage, 'confirmPlaceholder')}
          placeholderTextColor={palette.muted}
          style={styles.input}
          secureTextEntry
          editable={!isLoading}
        />

        <View style={styles.rememberRow}>
          <View style={styles.checkbox} />
          <Text style={styles.rememberText}>
            {getText(appLanguage, 'rememberMe')}
          </Text>
        </View>

        <PrimaryButton
          label={getText(appLanguage, 'register')}
          onPress={() => onRegister(name, email, phone, password, confirm)}
          isLoading={isLoading}
          disabled={isLoading}
        />
        <OutlineButton
          label={getText(appLanguage, 'signInWithGoogle')}
          onPress={() =>
            Alert.alert(
              getText(appLanguage, 'googleTitle'),
              getText(appLanguage, 'googleMessage')
            )
          }
          icon={googleIcon}
          disabled={isLoading}
        />

        <Pressable onPress={isLoading ? undefined : onGoLogin} disabled={isLoading}>
          <Text style={styles.authFooter}>
            {getText(appLanguage, 'alreadyHaveAccount')}{' '}
            <Text style={styles.linkText}>
              {getText(appLanguage, 'loginLink')}
            </Text>
          </Text>
        </Pressable>
      </ScrollView>
      <LoadingOverlay visible={isLoading} />
    </SafeAreaView>
  );
}

function LoadingOverlay({ visible }: { visible: boolean }) {
  const styles = useThemedStyles();
  if (!visible) {
    return null;
  }
  return (
    <View style={styles.loadingOverlay} pointerEvents="none">
      <View style={styles.loadingCard}>
        <LoadingDots />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    </View>
  );
}

function LoadingDots() {
  const styles = useThemedStyles();
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createPulse = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 420,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 420,
            useNativeDriver: true,
          }),
        ])
      );

    const a1 = createPulse(dot1, 0);
    const a2 = createPulse(dot2, 140);
    const a3 = createPulse(dot3, 280);
    a1.start();
    a2.start();
    a3.start();
  }, [dot1, dot2, dot3]);

  const dotStyle = (value: Animated.Value) => ({
    opacity: value.interpolate({
      inputRange: [0, 1],
      outputRange: [0.4, 1],
    }),
    transform: [
      {
        scale: value.interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 1.1],
        }),
      },
    ],
  });

  return (
    <View style={styles.loadingDots}>
      <Animated.View style={[styles.loadingDot, dotStyle(dot1)]} />
      <Animated.View style={[styles.loadingDot, dotStyle(dot2)]} />
      <Animated.View style={[styles.loadingDot, dotStyle(dot3)]} />
    </View>
  );
}

function ErrorToast({
  toast,
  onHide,
}: {
  toast: { title: string; message: string } | null;
  onHide: () => void;
}) {
  const styles = useThemedStyles();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) {
      return;
    }
    Animated.timing(anim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          onHide();
        }
      });
    }, 2400);

    return () => clearTimeout(timer);
  }, [anim, onHide, toast]);

  if (!toast) {
    return null;
  }

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 0],
  });

  return (
    <Animated.View
      style={[styles.errorToast, { opacity: anim, transform: [{ translateY }] }]}
    >
      <Text style={styles.errorTitle}>{toast.title}</Text>
      <Text style={styles.errorMessage}>{toast.message}</Text>
    </Animated.View>
  );
}

function LiveSignReaderScreen({
  appLanguage,
  outputLanguage,
  isConnected,
  onToggleConnection,
  connectionState,
  lastGesture,
  confidence,
  sentenceWords,
  holdProgress,
  topPredictions,
  sps,
  modelLoaded,
  onSpeak,
  onClearSentence,
  onUndoWord,
  onClose,
}: {
  appLanguage: AppLanguage;
  outputLanguage: OutputLanguage;
  isConnected: boolean;
  onToggleConnection: () => void;
  connectionState: string;
  lastGesture: string;
  confidence: number;
  sentenceWords: string[];
  holdProgress: number;
  topPredictions: { label: string; probability: number }[];
  sps: number;
  modelLoaded: boolean;
  onSpeak: () => void;
  onClearSentence: () => void;
  onUndoWord: () => void;
  onClose: () => void;
}) {
  const styles = useThemedStyles();
  const { palette } = useTheme();
  const confPct = (confidence * 100).toFixed(1);
  const confColor = confidence >= 0.8 ? palette.success : confidence > 0.5 ? '#f59e0b' : palette.red;

  return (
    <ScrollView contentContainerStyle={styles.profileScreenContent}>
      {/* Header with back button */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Pressable onPress={onClose} style={{ padding: 6 }}>
          <Text style={{ fontSize: 18, color: palette.ink }}>← Back</Text>
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: palette.ink }}>
          🤟 Live Sign Reader
        </Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Connection bar */}
      <View style={[styles.deviceCard, { marginBottom: 10 }]}>
        <View style={styles.deviceLeft}>
          <View style={styles.bluetoothBadge}>
            <Image source={bluetoothIcon} style={styles.bluetoothIcon} />
          </View>
          <View>
            <Text style={styles.deviceTitle}>
              {getText(appLanguage, 'deviceStatus')}
            </Text>
            <Text style={[styles.deviceStatus, { color: isConnected ? palette.success : palette.muted }]}>
              {connectionState === 'scanning' ? 'Scanning...' : connectionState === 'connecting' ? 'Connecting...' : isConnected ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {isConnected && sps > 0 && (
            <View style={{ backgroundColor: 'rgba(34,197,94,0.1)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)' }}>
              <Text style={{ color: palette.success, fontSize: 10, fontWeight: '700' }}>{sps} sps</Text>
            </View>
          )}
          {modelLoaded && (
            <View style={{ backgroundColor: 'rgba(99,102,241,0.1)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(99,102,241,0.25)' }}>
              <Text style={{ color: '#6366f1', fontSize: 10, fontWeight: '700' }}>🧠 Ready</Text>
            </View>
          )}
          <Pressable
            onPress={onToggleConnection}
            style={[styles.deviceButton, { backgroundColor: isConnected ? palette.white : palette.lavender }]}
          >
            <Text style={styles.deviceButtonText}>
              {isConnected ? getText(appLanguage, 'disconnect') : getText(appLanguage, 'connect')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Hero prediction */}
      <View style={[styles.card, { alignItems: 'center', paddingVertical: 24, marginBottom: 10 }]}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: palette.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          Detected Sign
        </Text>
        <Text style={{
          fontSize: 42,
          fontWeight: '900',
          color: confidence >= 0.8 ? palette.ink : palette.muted,
          textTransform: 'capitalize',
          marginBottom: 8,
        }}>
          {lastGesture || '—'}
        </Text>
        <Text style={{ fontSize: 16, fontWeight: '700', color: confColor, marginBottom: 6 }}>
          {isConnected ? `${confPct}%` : 'Waiting for data...'}
        </Text>
        <View style={{ width: '80%', height: 7, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 4, overflow: 'hidden' }}>
          <View style={{
            height: '100%',
            width: `${Math.min(100, confidence * 100)}%`,
            backgroundColor: confColor,
            borderRadius: 4,
          }} />
        </View>
        {holdProgress > 0 && holdProgress < 1 && (
          <Text style={{ fontSize: 12, color: '#6366f1', marginTop: 8, fontWeight: '600' }}>
            ⏳ Hold steady... {((1 - holdProgress) * 0.8).toFixed(1)}s
          </Text>
        )}
        {holdProgress >= 1 && (
          <Text style={{ fontSize: 12, color: palette.success, marginTop: 8, fontWeight: '600' }}>
            ✅ Added!
          </Text>
        )}
      </View>

      {/* Sentence builder */}
      <View style={[styles.card, { marginBottom: 10 }]}>
        <Text style={[styles.cardTitle, { marginBottom: 6 }]}>📝 Sentence</Text>
        <View style={{
          minHeight: 48,
          backgroundColor: 'rgba(0,0,0,0.03)',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: palette.border,
          padding: 10,
          marginBottom: 10,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 5,
        }}>
          {sentenceWords.length > 0 ? sentenceWords.map((w, i) => (
            <View key={`${w}-${i}`} style={{
              backgroundColor: 'rgba(99,102,241,0.08)',
              borderWidth: 1,
              borderColor: 'rgba(99,102,241,0.2)',
              borderRadius: 6,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}>
              <Text style={{ fontSize: 15, fontWeight: '500', color: palette.ink }}>
                {w === '…' ? '…' : (outputLanguage === 'Tamil'
                  ? (require('./services/sentenceBuilder').translateSign(w, 'ta'))
                  : (require('./services/sentenceBuilder').translateSign(w, 'si'))
                )}
              </Text>
            </View>
          )) : (
            <Text style={{ color: palette.muted, fontSize: 14, fontStyle: 'italic' }}>
              {isConnected ? 'Show a sign to build a sentence...' : 'Connect glove to start'}
            </Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <PrimaryButton
            label="🔊 Speak"
            onPress={onSpeak}
            disabled={sentenceWords.length === 0}
          />
          <Pressable onPress={onUndoWord} style={[styles.deviceButton, { backgroundColor: palette.lavender }]}>
            <Text style={styles.deviceButtonText}>⌫ Undo</Text>
          </Pressable>
          <Pressable onPress={onClearSentence} style={[styles.deviceButton, { backgroundColor: palette.lavender }]}>
            <Text style={styles.deviceButtonText}>🗑 Clear</Text>
          </Pressable>
        </View>
      </View>

      {/* Top predictions */}
      {topPredictions.length > 0 && (
        <View style={[styles.card, { marginBottom: 10 }]}>
          <Text style={styles.cardTitle}>📊 Top Predictions</Text>
          {topPredictions.map((pred, i) => (
            <View key={pred.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}>
              <Text style={{ width: 55, fontSize: 12, fontWeight: '700', color: palette.ink, textTransform: 'capitalize' }}>
                {outputLanguage === 'Tamil'
                  ? (require('./services/sentenceBuilder').translateSign(pred.label, 'ta'))
                  : (require('./services/sentenceBuilder').translateSign(pred.label, 'si'))
                }
              </Text>
              <View style={{ flex: 1, height: 6, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                <View style={{
                  height: '100%',
                  width: `${(pred.probability * 100).toFixed(1)}%` as any,
                  backgroundColor: i === 0 ? '#6366f1' : palette.muted,
                  borderRadius: 3,
                }} />
              </View>
              <Text style={{ width: 42, textAlign: 'right', fontSize: 11, color: palette.muted, fontWeight: '600' }}>
                {(pred.probability * 100).toFixed(1)}%
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function HomeScreen({
  statusText,
  isConnected,
  onToggleConnection,
  lastGesture,
  onGestureSample,
  userName,
  phrases,
  onOpenSavedPhrases,
  onOpenTutorials,
  onOpenLiveReader,
  appLanguage,
  outputLanguage,
}: {
  statusText: string;
  isConnected: boolean;
  onToggleConnection: () => void;
  lastGesture: string;
  onGestureSample: () => void;
  userName: string;
  phrases: string[];
  onOpenSavedPhrases: () => void;
  onOpenTutorials: () => void;
  onOpenLiveReader: () => void;
  appLanguage: AppLanguage;
  outputLanguage: OutputLanguage;
}) {
  const styles = useThemedStyles();
  const { palette } = useTheme();
  return (
    <ScrollView contentContainerStyle={styles.profileScreenContent}>
      <View style={styles.welcomePill}>
        <Text style={styles.welcomeText}>
          {getText(appLanguage, 'welcome')}
          {userName ? ` ${userName}` : ''}
        </Text>
      </View>

      <View style={styles.deviceCard}>
        <View style={styles.deviceLeft}>
          <View style={styles.bluetoothBadge}>
            <Image source={bluetoothIcon} style={styles.bluetoothIcon} />
          </View>
          <View>
            <Text style={styles.deviceTitle}>
              {getText(appLanguage, 'deviceStatus')}
            </Text>
            <Text
              style={[
                styles.deviceStatus,
                { color: isConnected ? palette.success : palette.muted },
              ]}
            >
              {statusText}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onToggleConnection}
          style={[
            styles.deviceButton,
            { backgroundColor: isConnected ? palette.white : palette.lavender },
          ]}
        >
          <Text style={styles.deviceButtonText}>
            {isConnected
              ? getText(appLanguage, 'disconnect')
              : getText(appLanguage, 'connect')}
          </Text>
        </Pressable>
      </View>

      {/* ─── Live Sign Reader Card ─── */}
      <Pressable
        style={[styles.card, {
          borderWidth: 1.5,
          borderColor: 'rgba(99,102,241,0.3)',
          backgroundColor: 'rgba(99,102,241,0.04)',
        }]}
        onPress={onOpenLiveReader}
      >
        <Text style={[styles.cardTitle, { color: '#6366f1' }]}>
          🤟 Live Sign Reader
        </Text>
        <Text style={styles.cardBody}>
          Real-time gesture recognition with sentence building
        </Text>
        <Text style={[styles.cardLink, { color: '#6366f1' }]}>
          Open →
        </Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {getText(appLanguage, 'speakingForYou')}
        </Text>
        <Text style={styles.speakerIcon}>[volume]</Text>
        <PrimaryButton
          label={getText(appLanguage, 'playSample')}
          onPress={onGestureSample}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {getText(appLanguage, 'lastGesture')}
        </Text>
        <Text style={styles.gestureText}>{lastGesture}</Text>
        <Text style={styles.gestureHint}>
          {getText(appLanguage, 'detecting')}
        </Text>
      </View>

      <Pressable style={styles.card} onPress={onOpenSavedPhrases}>
        <Text style={styles.cardTitle}>
          {getText(appLanguage, 'savedPhrases')}
        </Text>
        <Text style={styles.cardBody}>{phrases[0] ?? ''}</Text>
        <Text style={styles.cardBody}>{phrases[1] ?? ''}</Text>
        <Text style={styles.cardLink}>
          + {getText(appLanguage, 'others')}
        </Text>
      </Pressable>

      <Pressable style={styles.card} onPress={onOpenTutorials}>
        <Text style={styles.cardTitle}>
          {getText(appLanguage, 'tutorials')}
        </Text>
        <Text style={styles.cardBody}>
          {getText(appLanguage, 'setupGuide')}
        </Text>
        <Text style={styles.cardBody}>
          {getText(appLanguage, 'instructions')}
        </Text>
        <Text style={styles.cardBody}>
          {getText(appLanguage, 'howToWear')}
        </Text>
        <Text style={styles.cardBody}>
          {getText(appLanguage, 'howGestureWorks')}
        </Text>
        <Text style={styles.cardBody}>{getText(appLanguage, 'faqs')}</Text>
      </Pressable>
    </ScrollView>
  );
}

function LanguageScreen({
  appLanguage,
  outputLanguage,
  onChangeOutputLanguage,
}: {
  appLanguage: AppLanguage;
  outputLanguage: OutputLanguage;
  onChangeOutputLanguage: (value: OutputLanguage) => void;
}) {
  const styles = useThemedStyles();
  const selectedLabel =
    outputLanguageOptions.find((option) => option.key === outputLanguage)?.label ||
    outputLanguage;
  return (
    <ScrollView contentContainerStyle={styles.profileScreenContent}>
      <View style={styles.welcomePill}>
        <Text style={styles.welcomeText}>
          {getText(appLanguage, 'selectLanguage')}
        </Text>
      </View>
      <Text style={styles.languageHelp}>
        {getText(appLanguage, 'languageHelpSettings')}
      </Text>
      <View style={styles.languageCard}>
        <Text style={styles.cardBody}>{getText(appLanguage, 'languageOutputHint')}</Text>
        <Text style={[styles.languageText, styles.languageTextStack]}>{selectedLabel}</Text>
      </View>
      <View style={styles.manualLanguageBox}>
        {outputLanguageOptions.map((lang) => {
          const isSelected = outputLanguage === lang.key;
          return (
            <Pressable
              key={lang.key}
              onPress={() => onChangeOutputLanguage(lang.key)}
              style={[
                styles.languageCardSmall,
                isSelected && styles.languageCardSelected,
              ]}
            >
              <Text
                style={[
                  styles.languageTextSmall,
                  isSelected && styles.languageTextSmallActive,
                ]}
              >
                {lang.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function SavedPhrasesScreen({
  appLanguage,
  outputLanguage,
  phrases,
  onSpeak,
  onAddPhrase,
  onUpdatePhrase,
  onRemovePhrase,
  onChangeOutputLanguage,
  onClose,
}: {
  appLanguage: AppLanguage;
  outputLanguage: OutputLanguage;
  phrases: string[];
  onSpeak: (text: string) => void;
  onAddPhrase: (text: string) => void;
  onUpdatePhrase: (index: number, text: string) => void;
  onRemovePhrase: (index: number) => void;
  onChangeOutputLanguage: (value: OutputLanguage) => void;
  onClose: () => void;
}) {
  const styles = useThemedStyles();
  const { palette } = useTheme();
  const [newPhrase, setNewPhrase] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');

  const handleAdd = () => {
    const trimmed = newPhrase.trim();
    if (!trimmed) {
      return;
    }
    onAddPhrase(trimmed);
    setNewPhrase('');
  };

  const startEditing = (index: number, phrase: string) => {
    setEditingIndex(index);
    setEditingText(phrase);
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditingText('');
  };

  const saveEditing = () => {
    if (editingIndex === null) {
      return;
    }
    onUpdatePhrase(editingIndex, editingText);
    setEditingIndex(null);
    setEditingText('');
  };

  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <View style={styles.deviceHeaderRow}>
        <Pressable style={styles.deviceBackButton} onPress={onClose}>
          <Text style={styles.profileCloseText}>
            ‹ <Text style={styles.profileBackText}>{getText(appLanguage, 'back')}</Text>
          </Text>
        </Pressable>
        <Text style={styles.deviceHeaderTitle}>
          {getText(appLanguage, 'savedPhrases')}
        </Text>
      </View>

      <View style={styles.phrasesInputRow}>
        <TextInput
          value={newPhrase}
          onChangeText={setNewPhrase}
          placeholder={getText(appLanguage, 'newPhrasePlaceholder')}
          placeholderTextColor={palette.muted}
          style={styles.phrasesInput}
        />
        <Pressable onPress={handleAdd} style={styles.phrasesAddButton}>
          <Text style={styles.phrasesAddText}>{getText(appLanguage, 'addPhrase')}</Text>
        </Pressable>
      </View>

      <View style={styles.manualLanguageBox}>
        {outputLanguageOptions.map((lang) => {
          const isSelected = outputLanguage === lang.key;
          return (
            <Pressable
              key={lang.key}
              onPress={() => onChangeOutputLanguage(lang.key)}
              style={[
                styles.languageCardSmall,
                isSelected && styles.languageCardSelected,
              ]}
            >
              <Text
                style={[
                  styles.languageTextSmall,
                  isSelected && styles.languageTextSmallActive,
                ]}
              >
                {lang.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.phrasesList}>
        {phrases.map((phrase, index) => (
          <View key={`${phrase}-${index}`} style={styles.phraseItem}>
            {editingIndex === index ? (
              <TextInput
                value={editingText}
                onChangeText={setEditingText}
                style={styles.phraseEditInput}
                placeholderTextColor={palette.muted}
                autoFocus
              />
            ) : (
              <Pressable onPress={() => onSpeak(phrase)}>
                <Text style={styles.phraseText}>{phrase}</Text>
              </Pressable>
            )}
            <View style={styles.phraseActions}>
              {editingIndex === index ? (
                <>
                  <Pressable onPress={saveEditing}>
                    <Text style={styles.phraseActionText}>
                      {getText(appLanguage, 'savePhrase')}
                    </Text>
                  </Pressable>
                  <Pressable onPress={cancelEditing}>
                    <Text style={styles.phraseActionMuted}>
                      {getText(appLanguage, 'cancel')}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable onPress={() => startEditing(index, phrase)}>
                    <Text style={styles.phraseActionText}>
                      {getText(appLanguage, 'editPhrase')}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => onRemovePhrase(index)}>
                    <Text style={styles.phraseActionDanger}>
                      {getText(appLanguage, 'deletePhrase')}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        ))}
      </View>
      <Text style={styles.phrasesHint}>
        {outputLanguage === 'Sinhala' ? 'සිංහල' : 'தமிழ்'}
      </Text>
    </ScrollView>
  );
}

function UserScreen({
  appLanguage,
  profileName,
  profileDevice,
  profileEmail,
  profilePhone,
  voiceOutputOn,
  hapticAlertsOn,
  outputLanguage,
  onLogout,
}: {
  appLanguage: AppLanguage;
  profileName: string;
  profileDevice: string;
  profileEmail: string;
  profilePhone: string;
  voiceOutputOn: boolean;
  hapticAlertsOn: boolean;
  outputLanguage: OutputLanguage;
  onLogout: () => void;
}) {
  const styles = useThemedStyles();
  const outputLanguageLabel =
    outputLanguageOptions.find((option) => option.key === outputLanguage)?.label ||
    outputLanguage;
  return (
    <ScrollView contentContainerStyle={styles.profileScreenContent}>
      <View style={styles.welcomePill}>
        <Text style={styles.welcomeText}>
          {getText(appLanguage, 'userProfile')}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{getText(appLanguage, 'profile')}</Text>
        <Text style={styles.cardBody}>
          {getText(appLanguage, 'name')}: {profileName}
        </Text>
        <Text style={styles.cardBody}>
          {getText(appLanguage, 'email')}: {profileEmail}
        </Text>
        <Text style={styles.cardBody}>
          {getText(appLanguage, 'contactNumber')}: {profilePhone}
        </Text>
        <Text style={styles.cardBody}>
          {getText(appLanguage, 'device')}: {profileDevice}
        </Text>
        <Text style={styles.cardBody}>
          {getText(appLanguage, 'languagePreferenceLabel')}: {outputLanguageLabel}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {getText(appLanguage, 'settings')}
        </Text>
        <Text style={styles.cardBody}>
          {getText(appLanguage, 'voiceOutput')}: 
          {voiceOutputOn
            ? getText(appLanguage, 'on')
            : getText(appLanguage, 'off')}
        </Text>
        <Text style={styles.cardBody}>
          {getText(appLanguage, 'hapticAlerts')}: 
          {hapticAlertsOn
            ? getText(appLanguage, 'on')
            : getText(appLanguage, 'off')}
        </Text>
      </View>

      <PrimaryButton label={getText(appLanguage, 'menuLogout')} onPress={onLogout} />
    </ScrollView>
  );
}

function TabBar({
  activeTab,
  onChange,
  appLanguage,
}: {
  activeTab: TabScreen;
  onChange: (tab: TabScreen) => void;
  appLanguage: AppLanguage;
}) {
  const styles = useThemedStyles();
  return (
    <View style={styles.tabBar}>
      <TabButton
        label={getText(appLanguage, 'tabHome')}
        active={activeTab === 'home'}
        onPress={() => onChange('home')}
      />
      <TabButton
        label={getText(appLanguage, 'tabLanguage')}
        active={activeTab === 'language'}
        onPress={() => onChange('language')}
      />
      <TabButton
        label={getText(appLanguage, 'tabUser')}
        active={activeTab === 'user'}
        onPress={() => onChange('user')}
      />
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tabButton, active && styles.tabButtonActive]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SlideMenu({
  open,
  anim,
  onClose,
  appLanguage,
  onOpenProfile,
  onOpenDeviceSettings,
  onOpenTutorials,
  onOpenLiveReader,
  onOpenCalibrator,
  onLogout,
}: {
  open: boolean;
  anim: Animated.Value;
  onClose: () => void;
  appLanguage: AppLanguage;
  onOpenProfile: () => void;
  onOpenDeviceSettings: () => void;
  onOpenTutorials: () => void;
  onOpenLiveReader: () => void;
  onOpenCalibrator: () => void;
  onLogout: () => void;
}) {
  const styles = useThemedStyles();
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [MENU_WIDTH, 0],
  });

  if (!open) {
    return null;
  }

  return (
    <View style={styles.menuOverlay}>
      <Pressable style={styles.menuBackdrop} onPress={onClose} />
      <Animated.View
        style={[styles.menuPanel, { transform: [{ translateX }] }]}
      >
        <Text style={styles.menuTitle}>{getText(appLanguage, 'menuSettings')}</Text>
        <MenuItem label="🤟 Live Sign Reader" onPress={onOpenLiveReader} />
        <MenuItem label="🎯 Calibrator" onPress={onOpenCalibrator} />
        <View style={styles.menuDivider} />
        <MenuItem label={getText(appLanguage, 'menuProfile')} onPress={onOpenProfile} />
        <MenuItem
          label={getText(appLanguage, 'menuDeviceSettings')}
          onPress={onOpenDeviceSettings}
        />
        <MenuItem
          label={getText(appLanguage, 'menuVoiceOutput')}
          onPress={() => Alert.alert(getText(appLanguage, 'voiceTitle'))}
        />
        <MenuItem
          label={getText(appLanguage, 'menuTutorials')}
          onPress={onOpenTutorials}
        />
        <MenuItem
          label={getText(appLanguage, 'menuHelpSupport')}
          onPress={() => Alert.alert(getText(appLanguage, 'helpTitle'))}
        />
        <View style={styles.menuDivider} />
        <MenuItem label={getText(appLanguage, 'menuLogout')} onPress={onLogout} danger />
      </Animated.View>
    </View>
  );
}

function MenuItem({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const styles = useThemedStyles();
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <Text style={[styles.menuItemText, danger && styles.menuItemDanger]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ProfileScreen({
  appLanguage,
  name,
  email,
  phone,
  device,
  saved,
  onChangeName,
  onChangeEmail,
  onChangePhone,
  onChangeDevice,
  onSave,
  onClose,
}: {
  appLanguage: AppLanguage;
  name: string;
  email: string;
  phone: string;
  device: string;
  saved: { name: string; email: string; phone: string; device: string };
  onChangeName: (value: string) => void;
  onChangeEmail: (value: string) => void;
  onChangePhone: (value: string) => void;
  onChangeDevice: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const styles = useThemedStyles();
  const { palette } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const hasChanges =
    name !== saved.name ||
    email !== saved.email ||
    phone !== saved.phone ||
    device !== saved.device;

  const handleSave = () => {
    if (!hasChanges) {
      return;
    }
    onSave();
    setIsEditing(false);
  };

  const handleCancel = () => {
    onChangeName(saved.name);
    onChangeEmail(saved.email);
    onChangePhone(saved.phone);
    onChangeDevice(saved.device);
    setIsEditing(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <View style={styles.deviceHeaderRow}>
        <Pressable style={styles.deviceBackButton} onPress={onClose}>
          <Text style={styles.profileCloseText}>
            ‹ <Text style={styles.profileBackText}>{getText(appLanguage, 'back')}</Text>
          </Text>
        </Pressable>
        <Text style={styles.deviceHeaderTitle}>
          {getText(appLanguage, 'profile')}
        </Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileHeaderActions}>
            {!isEditing && (
              <Pressable
                onPress={() => setIsEditing(true)}
                style={styles.profileEditPrimary}
              >
                <Text style={styles.profileEditPrimaryText}>
                  {getText(appLanguage, 'edit')}
                </Text>
              </Pressable>
            )}
            {isEditing && (
              <Pressable
                onPress={() =>
                  Alert.alert(
                    getText(appLanguage, 'profilePictureTitle'),
                    getText(appLanguage, 'profilePictureMessage')
                  )
                }
              >
                <Text style={styles.profilePhotoLink}>
                  {getText(appLanguage, 'changePhoto')}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        <Text style={styles.profileLabel}>{getText(appLanguage, 'name')}</Text>
        <TextInput
          value={name}
          onChangeText={onChangeName}
          style={[styles.profileInput, !isEditing && styles.profileInputDisabled]}
          editable={isEditing}
          placeholder={getText(appLanguage, 'fullNamePlaceholder')}
          placeholderTextColor={palette.muted}
        />

        <Text style={styles.profileLabel}>{getText(appLanguage, 'email')}</Text>
        <TextInput
          value={email}
          onChangeText={onChangeEmail}
          style={[styles.profileInput, !isEditing && styles.profileInputDisabled]}
          editable={isEditing}
          placeholder={getText(appLanguage, 'emailPlaceholder')}
          placeholderTextColor={palette.muted}
          keyboardType="email-address"
        />

        <Text style={styles.profileLabel}>{getText(appLanguage, 'contactNumber')}</Text>
        <TextInput
          value={phone}
          onChangeText={onChangePhone}
          style={[styles.profileInput, !isEditing && styles.profileInputDisabled]}
          editable={isEditing}
          placeholder={getText(appLanguage, 'contactPlaceholder')}
          placeholderTextColor={palette.muted}
          keyboardType="phone-pad"
        />

        <Text style={styles.profileLabel}>{getText(appLanguage, 'device')}</Text>
        <TextInput
          value={device}
          onChangeText={onChangeDevice}
          style={[styles.profileInput, !isEditing && styles.profileInputDisabled]}
          editable={isEditing}
          placeholder={getText(appLanguage, 'device')}
          placeholderTextColor={palette.muted}
        />
      </View>

      {isEditing && (
        <>
          <Pressable
            onPress={handleSave}
            disabled={!hasChanges}
            style={[
              styles.profileSaveButton,
              !hasChanges && styles.profileSaveButtonDisabled,
            ]}
          >
            <Text
              style={[
                styles.profileSaveText,
                !hasChanges && styles.profileSaveTextDisabled,
              ]}
            >
              {getText(appLanguage, 'saveChanges')}
            </Text>
          </Pressable>
          <Pressable onPress={handleCancel} style={styles.profileCancelButton}>
            <Text style={styles.profileCancelText}>
              {getText(appLanguage, 'cancel')}
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function DeviceSettingsScreen({
  appLanguage,
  voiceOutputOn,
  hapticAlertsOn,
  isDarkMode,
  selectedLanguage,
  onToggleVoice,
  onToggleHaptics,
  onToggleDarkMode,
  onChangeLanguage,
  onClose,
}: {
  appLanguage: AppLanguage;
  voiceOutputOn: boolean;
  hapticAlertsOn: boolean;
  isDarkMode: boolean;
  selectedLanguage: AppLanguage;
  onToggleVoice: () => void;
  onToggleHaptics: () => void;
  onToggleDarkMode: () => void;
  onChangeLanguage: (value: AppLanguage) => void;
  onClose: () => void;
}) {
  const styles = useThemedStyles();
  return (
    <ScrollView contentContainerStyle={styles.profileScreenContent}>
      <View style={styles.deviceHeaderRow}>
        <Pressable style={styles.deviceBackButton} onPress={onClose}>
          <Text style={styles.profileCloseText}>
            ‹ <Text style={styles.profileBackText}>{getText(appLanguage, 'back')}</Text>
          </Text>
        </Pressable>
        <Text style={styles.deviceHeaderTitle}>
          {getText(appLanguage, 'deviceSettings')}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{getText(appLanguage, 'output')}</Text>
        <SettingRow
          label={getText(appLanguage, 'voiceOutput')}
          value={
            voiceOutputOn
              ? getText(appLanguage, 'on')
              : getText(appLanguage, 'off')
          }
          onToggle={onToggleVoice}
          active={voiceOutputOn}
        />
        <SettingRow
          label={getText(appLanguage, 'hapticAlerts')}
          value={
            hapticAlertsOn
              ? getText(appLanguage, 'on')
              : getText(appLanguage, 'off')
          }
          onToggle={onToggleHaptics}
          active={hapticAlertsOn}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{getText(appLanguage, 'settings')}</Text>
        <SettingRow
          label={getText(appLanguage, 'darkMode')}
          value={
            isDarkMode
              ? getText(appLanguage, 'on')
              : getText(appLanguage, 'off')
          }
          onToggle={onToggleDarkMode}
          active={isDarkMode}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{getText(appLanguage, 'appLanguage')}</Text>
        <View style={styles.manualLanguageBox}>
          {appLanguageOptions.map((lang) => {
            const isSelected = selectedLanguage === lang.key;
            return (
              <Pressable
                key={lang.key}
                onPress={() => onChangeLanguage(lang.key)}
                style={[
                  styles.languageCardSmall,
                  isSelected && styles.languageCardSelected,
                ]}
              >
                <Text
                  style={[
                    styles.languageTextSmall,
                    isSelected && styles.languageTextSmallActive,
                  ]}
                >
                  {lang.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

function TutorialsScreen({
  appLanguage,
  onClose,
}: {
  appLanguage: AppLanguage;
  onClose: () => void;
}) {
  const styles = useThemedStyles();
  return (
    <ScrollView contentContainerStyle={styles.profileScreenContent}>
      <View style={styles.deviceHeaderRow}>
        <Pressable style={styles.deviceBackButton} onPress={onClose}>
          <Text style={styles.profileCloseText}>
            ‹ <Text style={styles.profileBackText}>{getText(appLanguage, 'back')}</Text>
          </Text>
        </Pressable>
        <Text style={styles.deviceHeaderTitle}>
          {getText(appLanguage, 'tutorialsTitle')}
        </Text>
      </View>

      {tutorialSteps.map((step, index) => (
        <View key={step.title} style={styles.tutorialCard}>
          <Image source={step.image} style={styles.tutorialImage} />
          <Text style={styles.tutorialStepLabel}>Step {index + 1}</Text>
          <Text style={styles.tutorialStepTitle}>{step.title}</Text>
          <Text style={styles.tutorialStepBody}>{step.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function SettingRow({
  label,
  value,
  onToggle,
  active,
}: {
  label: string;
  value: string;
  onToggle: () => void;
  active: boolean;
}) {
  const styles = useThemedStyles();
  return (
    <View style={styles.settingRow}>
      <View>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingValue}>{value}</Text>
      </View>
      <Pressable
        onPress={onToggle}
        style={[styles.settingToggle, active && styles.settingToggleActive]}
      >
        <View
          style={[
            styles.settingKnob,
            active && styles.settingKnobActive,
          ]}
        />
      </Pressable>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  isLoading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}) {
  const styles = useThemedStyles();
  const { palette } = useTheme();
  const isDisabled = disabled || isLoading;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.primaryButton, isDisabled && styles.primaryButtonDisabled]}
      disabled={isDisabled}
    >
      {isLoading ? (
        <ActivityIndicator color={palette.white} />
      ) : (
        <Text style={styles.primaryButtonText}>{label}</Text>
      )}
    </Pressable>
  );
}

function OutlineButton({
  label,
  onPress,
  icon,
  disabled,
}: {
  label: string;
  onPress: () => void;
  icon?: number;
  disabled?: boolean;
}) {
  const styles = useThemedStyles();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.outlineButton, disabled && styles.outlineButtonDisabled]}
      disabled={disabled}
    >
      <View style={styles.outlineButtonContent}>
        {icon && <Image source={icon} style={styles.outlineButtonIcon} />}
        <Text style={styles.outlineButtonText}>{label}</Text>
      </View>
    </Pressable>
  );
}

const MENU_WIDTH = 280;

const createStyles = (palette: ThemePalette) =>
  StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: palette.soft,
  },
  splashContainer: {
    flex: 1,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.lavender,
  },
  splashOrb: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: palette.lavenderDeep,
    top: -60,
    left: -40,
  },
  splashOrbTwo: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: palette.lavenderDeep,
    bottom: -40,
    right: -30,
  },
  splashCard: {
    width: '78%',
    backgroundColor: palette.white,
    borderRadius: 28,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  splashLogo: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: palette.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogoText: {
    color: palette.white,
    fontWeight: '800',
    fontSize: 22,
    letterSpacing: 1,
  },
  splashTitle: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: '800',
    color: palette.ink,
    letterSpacing: 1,
  },
  splashSubtitle: {
    marginTop: 6,
    color: palette.muted,
    textAlign: 'center',
  },
  splashLoaderRow: {
    marginTop: 18,
  },
  firstTimeContainer: {
    flex: 1,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  firstTimeBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.lavender,
  },
  firstTimeOrb: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: palette.lavenderDeep,
    top: -80,
    right: -60,
  },
  firstTimeOrbTwo: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: palette.lavender,
    bottom: -60,
    left: -40,
  },
  firstTimeCard: {
    width: '100%',
    borderRadius: 28,
    paddingVertical: 30,
    paddingHorizontal: 22,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  firstTimeEyebrow: {
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '700',
    color: palette.red,
  },
  firstTimeTitle: {
    marginTop: 8,
    fontSize: 26,
    fontWeight: '800',
    color: palette.ink,
  },
  firstTimeSubtitle: {
    marginTop: 10,
    color: palette.muted,
    lineHeight: 20,
  },
  firstTimeBadgeRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  firstTimeBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: palette.lavender,
    borderWidth: 1,
    borderColor: palette.lavenderDeep,
  },
  firstTimeBadgeText: {
    color: palette.ink,
    fontWeight: '600',
    fontSize: 12,
  },
  firstTimePrimary: {
    marginTop: 20,
    backgroundColor: palette.red,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  firstTimePrimaryText: {
    color: palette.white,
    fontWeight: '700',
  },
  firstTimeSecondary: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  firstTimeSecondaryText: {
    color: palette.ink,
    fontWeight: '600',
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.white,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: palette.muted,
    fontWeight: '600',
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 8,
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.red,
  },
  errorToast: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    backgroundColor: '#3A1F24',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#5C2B32',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 10,
  },
  errorTitle: {
    color: palette.white,
    fontWeight: '800',
  },
  errorMessage: {
    color: '#F5D7DC',
    marginTop: 4,
  },
  authContainer: {
    flex: 1,
    backgroundColor: palette.white,
  },
  authContent: {
    padding: 24,
    paddingTop: 72,
  },
  authBrandRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  authBrand: {
    fontSize: 30,
    fontWeight: '700',
    color: palette.ink,
    textAlign: 'center',
    letterSpacing: 1,
  },
  authBrandAccent: {
    color: palette.red,
  },
  authSubtitle: {
    marginTop: 8,
    textAlign: 'center',
    color: palette.muted,
    fontSize: 12,
    letterSpacing: 1,
  },
  inputLabel: {
    marginTop: 18,
    marginBottom: 6,
    color: palette.ink,
    fontWeight: '600',
  },
  input: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: palette.ink,
  },
  forgotText: {
    textAlign: 'right',
    color: palette.muted,
    marginTop: 8,
  },
  authFooter: {
    textAlign: 'center',
    color: palette.muted,
    marginTop: 18,
  },
  linkText: {
    color: palette.red,
    fontWeight: '600',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 4,
    marginRight: 8,
  },
  rememberText: {
    color: palette.muted,
  },
  primaryButton: {
    marginTop: 20,
    backgroundColor: palette.red,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: palette.white,
    fontWeight: '700',
  },
  outlineButton: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: palette.white,
  },
  outlineButtonDisabled: {
    opacity: 0.6,
  },
  outlineButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  outlineButtonIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  outlineButtonText: {
    color: palette.ink,
    fontWeight: '600',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 34,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandTop: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink,
  },
  brandBottom: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.red,
    letterSpacing: 1,
  },
  menuButton: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLines: {
    width: 18,
    height: 14,
    justifyContent: 'space-between',
  },
  menuLine: {
    height: 2,
    backgroundColor: palette.ink,
    borderRadius: 2,
  },
  screenContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  profileScreenContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 120,
  },
  phrasesInputRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  phrasesInput: {
    flex: 1,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.ink,
  },
  phrasesAddButton: {
    backgroundColor: palette.red,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  phrasesAddText: {
    color: palette.white,
    fontWeight: '700',
  },
  phrasesList: {
    marginTop: 16,
    gap: 10,
  },
  phraseItem: {
    backgroundColor: palette.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  phraseEditInput: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: palette.ink,
    marginBottom: 8,
  },
  phraseActions: {
    flexDirection: 'row',
    gap: 16,
  },
  phraseActionText: {
    color: palette.ink,
    fontWeight: '700',
  },
  phraseActionMuted: {
    color: palette.muted,
    fontWeight: '600',
  },
  phraseActionDanger: {
    color: palette.red,
    fontWeight: '700',
  },
  phraseText: {
    color: palette.ink,
    fontWeight: '600',
  },
  phrasesHint: {
    marginTop: 12,
    color: palette.muted,
    textAlign: 'center',
  },
  welcomePill: {
    marginTop: 8,
    backgroundColor: palette.lavender,
    paddingVertical: 10,
    borderRadius: 18,
    alignItems: 'center',
  },
  welcomeText: {
    color: palette.ink,
    fontWeight: '600',
  },
  deviceCard: {
    marginTop: 16,
    backgroundColor: palette.lavender,
    padding: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: palette.lavenderDeep,
  },
  deviceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bluetoothBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.lavenderDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bluetoothText: {
    fontWeight: '700',
    color: palette.ink,
  },
  bluetoothIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  deviceTitle: {
    fontWeight: '700',
    color: palette.ink,
  },
  deviceStatus: {
    fontSize: 12,
  },
  deviceButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  deviceButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.ink,
  },
  card: {
    marginTop: 16,
    backgroundColor: palette.white,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  tutorialCard: {
    marginTop: 16,
    backgroundColor: palette.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  tutorialImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  tutorialStepLabel: {
    marginTop: 12,
    marginHorizontal: 16,
    color: palette.muted,
    fontWeight: '600',
    letterSpacing: 1,
    fontSize: 11,
  },
  tutorialStepTitle: {
    marginTop: 6,
    marginHorizontal: 16,
    color: palette.ink,
    fontWeight: '700',
    fontSize: 16,
  },
  tutorialStepBody: {
    marginTop: 6,
    marginHorizontal: 16,
    marginBottom: 16,
    color: palette.muted,
    lineHeight: 20,
  },
  cardTitle: {
    fontWeight: '700',
    marginBottom: 6,
    color: palette.ink,
  },
  cardBody: {
    color: palette.muted,
    marginTop: 2,
  },
  cardLink: {
    marginTop: 6,
    color: palette.red,
    fontWeight: '600',
  },
  speakerIcon: {
    marginTop: 8,
    marginBottom: 12,
    fontSize: 18,
    color: palette.muted,
  },
  gestureText: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.ink,
    marginTop: 6,
  },
  gestureHint: {
    color: palette.muted,
    marginTop: 4,
  },
  languageHelp: {
    marginTop: 16,
    textAlign: 'center',
    color: palette.muted,
  },
  languageCard: {
    marginTop: 18,
    paddingVertical: 26,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  languageCardSelected: {
    backgroundColor: '#3BC16B',
    borderColor: '#2AA95A',
  },
  languageText: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.ink,
  },
  languageTextStack: {
    marginTop: 6,
  },
  languageSelected: {
    marginTop: 6,
    color: palette.white,
    fontWeight: '600',
  },
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    backgroundColor: palette.lavender,
    borderRadius: 24,
    padding: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: palette.lavenderDeep,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 18,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: palette.white,
  },
  tabText: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: '600',
  },
  tabTextActive: {
    color: palette.ink,
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  menuPanel: {
    width: MENU_WIDTH,
    height: '100%',
    backgroundColor: palette.white,
    paddingTop: 72,
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: palette.ink,
  },
  menuItem: {
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 15,
    color: palette.ink,
    fontWeight: '600',
  },
  menuItemDanger: {
    color: palette.red,
  },
  menuDivider: {
    height: 1,
    backgroundColor: palette.border,
    marginVertical: 12,
  },
  deviceHeaderRow: {
    marginBottom: 12,
    gap: 8,
  },
  deviceBackButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  deviceHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink,
    textAlign: 'center',
  },
  profileCloseText: {
    color: palette.red,
    fontWeight: '800',
    fontSize: 22,
  },
  profileBackText: {
    fontSize: 22,
  },
  profileCard: {
    padding: 16,
    backgroundColor: palette.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  profileHeader: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  profileHeaderActions: {
    alignItems: 'flex-end',
    alignSelf: 'stretch',
    gap: 8,
  },
  profileEditPrimary: {
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
    backgroundColor: palette.white,
  },
  profileEditPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.ink,
    letterSpacing: 0.4,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.lavender,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.lavenderDeep,
  },
  profileAvatarText: {
    fontWeight: '700',
    fontSize: 22,
    color: palette.ink,
  },
  profilePhotoLink: {
    color: palette.red,
    fontWeight: '600',
  },
  profileLabel: {
    fontSize: 12,
    color: palette.muted,
    marginBottom: 4,
  },
  profileInput: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: palette.ink,
    marginBottom: 10,
  },
  profileInputDisabled: {
    color: palette.muted,
    backgroundColor: palette.soft,
  },
  profileSaveButton: {
    marginTop: 16,
    backgroundColor: palette.red,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  profileSaveButtonDisabled: {
    backgroundColor: '#F2B7B9',
  },
  profileSaveText: {
    color: palette.white,
    fontWeight: '700',
  },
  profileSaveTextDisabled: {
    color: '#FFFFFF',
  },
  profileCancelButton: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: palette.white,
  },
  profileCancelText: {
    color: palette.ink,
    fontWeight: '700',
  },
  settingRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLabel: {
    fontWeight: '600',
    color: palette.ink,
  },
  settingValue: {
    color: palette.muted,
    marginTop: 2,
  },
  settingToggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.lavenderDeep,
    padding: 3,
    justifyContent: 'center',
  },
  settingToggleActive: {
    backgroundColor: palette.success,
  },
  settingKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.white,
    alignSelf: 'flex-start',
  },
  settingKnobActive: {
    alignSelf: 'flex-end',
  },
  segmentRow: {
    marginTop: 10,
    flexDirection: 'row',
    backgroundColor: palette.lavenderDeep,
    borderRadius: 14,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: palette.white,
  },
  segmentText: {
    color: palette.muted,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: palette.ink,
  },
  manualLanguageBox: {
    marginTop: 12,
  },
  languageCardSmall: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  languageTextSmall: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink,
  },
  languageTextSmallActive: {
    color: palette.white,
  },
  });

const baseStyles = createStyles(lightPalette);

type ThemeContextValue = {
  palette: ThemePalette;
  styles: ReturnType<typeof createStyles>;
  isDark: boolean;
};

const ThemeContext = React.createContext<ThemeContextValue>({
  palette: lightPalette,
  styles: baseStyles,
  isDark: false,
});

export const useTheme = () => useContext(ThemeContext);

export const useThemedStyles = () => useContext(ThemeContext).styles;
