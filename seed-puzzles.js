const mongoose = require('mongoose');
require('dotenv').config();

const Puzzle = require('./models/Puzzle');
const EngagementContent = require('./models/EngagementContent');

const puzzles = [
    // KIDS (Under 15)
    { question: "Find the odd one out: 🍎, 🍌, ✈️, 🍉", answer: "✈️", options: ["🍎", "🍌", "✈️", "🍉"], category: "logic", difficulty: "easy", ageGroup: "kids" },
    { question: "What is 2 + 3?", answer: "5", options: ["4", "5", "6", "7"], category: "math", difficulty: "easy", ageGroup: "kids" },
    { question: "What comes next? 2, 4, 6, 8, ?", answer: "10", options: ["9", "10", "11", "12"], category: "math", difficulty: "medium", ageGroup: "kids" },
    { question: "Guess the animal: 🐶 + 🏠", answer: "Dog", options: ["Cat", "Dog", "Bird", "Fish"], category: "emoji", difficulty: "easy", ageGroup: "kids" },
    { question: "Complete the pattern: Red, Blue, Red, Blue, ?", answer: "Red", options: ["Green", "Yellow", "Red", "Blue"], category: "pattern", difficulty: "easy", ageGroup: "kids" },
    { question: "Which word starts with 'B'? Apple, Banana, Cherry", answer: "Banana", options: ["Apple", "Banana", "Cherry", "Date"], category: "word", difficulty: "easy", ageGroup: "kids" },
    { question: "Guess the word: 🌧️ + 🏹", answer: "Rainbow", options: ["Raindrop", "Bowtie", "Rainbow", "Weather"], category: "emoji", difficulty: "medium", ageGroup: "kids" },
    { question: "If you have 3 apples and you eat 1, how many are left?", answer: "2", options: ["1", "2", "3", "4"], category: "logic", difficulty: "medium", ageGroup: "kids" },
    { question: "Unscramble: A E P L P", answer: "Apple", options: ["Paper", "Apple", "Lapel", "Pale"], category: "word", difficulty: "medium", ageGroup: "kids" },
    { question: "What has legs but cannot walk?", answer: "Table", options: ["Snake", "Table", "Car", "River"], category: "logic", difficulty: "hard", ageGroup: "kids" },
    { question: "10 - ? = 4", answer: "6", options: ["5", "6", "7", "8"], category: "math", difficulty: "hard", ageGroup: "kids" },
    { question: "Which shape has 3 sides?", answer: "Triangle", options: ["Square", "Circle", "Triangle", "Star"], category: "logic", difficulty: "easy", ageGroup: "kids" },
    { question: "0, 5, 10, 15, ?", answer: "20", options: ["16", "18", "20", "25"], category: "pattern", difficulty: "medium", ageGroup: "kids" },

    // TEENAGERS (15–20)
    { question: "Identify the movie: 🕷️ + 👨", answer: "Spider-Man", options: ["Ant-Man", "Batman", "Spider-Man", "Iron Man"], category: "emoji", difficulty: "easy", ageGroup: "teens" },
    { question: "What is 15 - 8?", answer: "7", options: ["6", "7", "8", "9"], category: "math", difficulty: "easy", ageGroup: "teens" },
    { question: "Fill in the blank: T _ M E", answer: "I", options: ["A", "E", "I", "O"], category: "word", difficulty: "easy", ageGroup: "teens" },
    { question: "Next in sequence: 1, 3, 5, 7, ?", answer: "9", options: ["8", "9", "10", "11"], category: "pattern", difficulty: "easy", ageGroup: "teens" },
    { question: "Solve: 5 x 6 = ?", answer: "30", options: ["25", "30", "35", "40"], category: "math", difficulty: "medium", ageGroup: "teens" },
    { question: "Which emoji doesn't belong? ⚽ 🏀 🍎 🏐", answer: "🍎", options: ["⚽", "🏀", "🍎", "🏐"], category: "spot-difference", difficulty: "medium", ageGroup: "teens" },
    { question: "I speak without a mouth and hear without ears. What am I?", answer: "Echo", options: ["Wind", "Echo", "Shadow", "Ghost"], category: "logic", difficulty: "medium", ageGroup: "teens" },
    { question: "Unscramble: O M C P U T R E", answer: "Computer", options: ["Commuter", "Computer", "Compare", "Compute"], category: "word", difficulty: "medium", ageGroup: "teens" },
    { question: "If 3 cats catch 3 mice in 3 minutes, how many cats catch 100 mice in 100 minutes?", answer: "3", options: ["100", "3", "33", "10"], category: "logic", difficulty: "hard", ageGroup: "teens" },
    { question: "What is the square root of 144?", answer: "12", options: ["10", "11", "12", "14"], category: "math", difficulty: "hard", ageGroup: "teens" },
    { question: "Next in pattern: J, F, M, A, M, J, ?", answer: "J", options: ["A", "S", "O", "J"], category: "pattern", difficulty: "hard", ageGroup: "teens" },
    { question: "A girl has as many brothers as sisters, but each boy has only half as many brothers as sisters. How many brothers and sisters are there?", answer: "4 sisters, 3 brothers", options: ["3 sisters, 2 brothers", "4 sisters, 3 brothers", "5 sisters, 4 brothers", "2 sisters, 1 brother"], category: "logic", difficulty: "hard", ageGroup: "teens" },

    // ADULTS (20–45)
    { question: "Identify the brand: 🍎 + 💻", answer: "Apple", options: ["Microsoft", "Apple", "Dell", "HP"], category: "emoji", difficulty: "easy", ageGroup: "adults" },
    { question: "Solve: 12 + 15", answer: "27", options: ["25", "26", "27", "28"], category: "math", difficulty: "easy", ageGroup: "adults" },
    { question: "Spot the difference: 🚘 🚗 🚘 🚘", answer: "🚗", options: ["🚘 (1)", "🚗", "🚘 (3)", "🚘 (4)"], category: "spot-difference", difficulty: "easy", ageGroup: "adults" },
    { question: "Next in pattern: 2, 4, 8, 16, ?", answer: "32", options: ["24", "30", "32", "64"], category: "pattern", difficulty: "easy", ageGroup: "adults" },
    { question: "What goes up but never comes down?", answer: "Age", options: ["Balloon", "Smoke", "Age", "Bird"], category: "logic", difficulty: "medium", ageGroup: "adults" },
    { question: "Unscramble: I R N O N E M E T V N", answer: "Environment", options: ["Enlightenment", "Environment", "Entertainment", "Improvement"], category: "word", difficulty: "medium", ageGroup: "adults" },
    { question: "Solve: 8 x 7 + 4", answer: "60", options: ["56", "60", "64", "68"], category: "math", difficulty: "medium", ageGroup: "adults" },
    { question: "What gets wetter the more it dries?", answer: "Towel", options: ["Sponge", "Towel", "Water", "Air"], category: "logic", difficulty: "medium", ageGroup: "adults" },
    { question: "A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost?", answer: "$0.05", options: ["$0.10", "$0.05", "$0.01", "$1.00"], category: "math", difficulty: "hard", ageGroup: "adults" },
    { question: "Next in pattern: 1, 1, 2, 3, 5, 8, ?", answer: "13", options: ["10", "11", "12", "13"], category: "pattern", difficulty: "hard", ageGroup: "adults" },
    { question: "I have branches, but no fruit, trunk or leaves. What am I?", answer: "Bank", options: ["River", "Bank", "Tree", "Company"], category: "logic", difficulty: "hard", ageGroup: "adults" },
    { question: "If 1=3, 2=3, 3=5, 4=4, 5=4, then 6=?", answer: "3", options: ["3", "4", "5", "6"], category: "pattern", difficulty: "hard", ageGroup: "adults" },

    // SENIORS (45+)
    { question: "Solve: 50 + 25", answer: "75", options: ["65", "70", "75", "80"], category: "math", difficulty: "easy", ageGroup: "seniors" },
    { question: "Identify the phrase: ⏰ = 💰", answer: "Time is money", options: ["Time is gold", "Time flies", "Time is money", "Money buys time"], category: "emoji", difficulty: "easy", ageGroup: "seniors" },
    { question: "Next in pattern: 10, 20, 30, 40, ?", answer: "50", options: ["45", "50", "55", "60"], category: "pattern", difficulty: "easy", ageGroup: "seniors" },
    { question: "Which word starts with 'S'? Tree, Sun, Moon", answer: "Sun", options: ["Tree", "Sun", "Moon", "Star"], category: "word", difficulty: "easy", ageGroup: "seniors" },
    { question: "What has hands but can not clap?", answer: "Clock", options: ["Clock", "Tree", "Monkey", "Robot"], category: "logic", difficulty: "medium", ageGroup: "seniors" },
    { question: "Identify the movie: 🚢 + 🧊 + 💔", answer: "Titanic", options: ["Ice Age", "Titanic", "Love Story", "Jaws"], category: "emoji", difficulty: "medium", ageGroup: "seniors" },
    { question: "Solve for x: x + 15 = 40", answer: "25", options: ["20", "25", "30", "35"], category: "math", difficulty: "medium", ageGroup: "seniors" },
    { question: "Spot the difference: ☕ ☕ 🍵 ☕", answer: "🍵", options: ["☕ (1)", "☕ (2)", "🍵", "☕ (4)"], category: "spot-difference", difficulty: "medium", ageGroup: "seniors" },
    { question: "Unscramble: Y M M E O R", answer: "Memory", options: ["Mirror", "Memory", "Money", "Monkey"], category: "word", difficulty: "medium", ageGroup: "seniors" },
    { question: "Next in sequence: 2, 6, 12, 20, 30, ?", answer: "42", options: ["36", "40", "42", "48"], category: "pattern", difficulty: "hard", ageGroup: "seniors" },
    { question: "Mary's father has 5 daughters: 1. Nana, 2. Nene, 3. Nini, 4. Nono. What is the name of the 5th daughter?", answer: "Mary", options: ["Nunu", "Nina", "Mary", "None"], category: "logic", difficulty: "hard", ageGroup: "seniors" },
    { question: "Solve: 15% of 200", answer: "30", options: ["15", "20", "30", "40"], category: "math", difficulty: "hard", ageGroup: "seniors" },
    { question: "What begins with T, ends with T, and has T in it?", answer: "Teapot", options: ["Tent", "Tart", "Teapot", "Toast"], category: "logic", difficulty: "hard", ageGroup: "seniors" }
];

const contentItems = [
    // KIDS
    { type: "fact", content: "Did you know? Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible!", ageGroup: "kids" },
    { type: "tip", content: "A healthy tip: Eating breakfast helps your brain wake up and stay focused for learning all day!", ageGroup: "kids" },
    { type: "poetry", content: "Twinkle, twinkle, little star, how I wonder what you are. Up above the world so high, like a diamond in the sky.", ageGroup: "kids" },
    { type: "reading", content: "Elephants are the largest land animals. They are very social and live in groups called herds. They can even recognize themselves in a mirror!", ageGroup: "kids" },
    { type: "fact", content: "A snail can sleep for three years.", ageGroup: "kids" },
    { type: "fact", content: "The heart of a shrimp is located in its head.", ageGroup: "kids" },
    { type: "tip", content: "Wash your hands for 20 seconds to keep the germs away!", ageGroup: "kids" },
    { type: "fact", content: "Octopuses have three hearts.", ageGroup: "kids" },
    { type: "reading", content: "The blue whale is so big that a human could swim through its arteries!", ageGroup: "kids" },
    { type: "fact", content: "Koalas have fingerprints, just like humans.", ageGroup: "kids" },
    { type: "fact", content: "Bananas are berries, but strawberries are not!", ageGroup: "kids" },
    { type: "fact", content: "A group of flamingos is called a flamboyance.", ageGroup: "kids" },
    { type: "tip", content: "Reading just 15 minutes every day can improve your imagination and vocabulary.", ageGroup: "kids" },
    { type: "reading", content: "The cheetah is the fastest land animal and can run up to 70 miles per hour for short distances.", ageGroup: "kids" },
    { type: "poetry", content: "Little drops of water, little grains of sand, make the mighty ocean and the pleasant land.", ageGroup: "kids" },


    // TEENS
    { type: "quote", content: "The future belongs to those who believe in the beauty of their dreams. — Eleanor Roosevelt", ageGroup: "teens" },
    { type: "fact", content: "An average person spends about six months of their entire life waiting for red lights to turn green.", ageGroup: "teens" },
    { type: "tip", content: "Productivity hack: The Pomodoro Technique suggests working for 25 minutes and then taking a 5-minute break to stay fresh.", ageGroup: "teens" },
    { type: "reading", content: "In 1945, a group of Soviet school children presented a hand-carved US Seal to the US Ambassador. It contained a listening device that went undetected for seven years.", ageGroup: "teens" },
    { type: "fact", content: "Instagram was originally called Burbn.", ageGroup: "teens" },
    { type: "tip", content: "Learn one new word every day to expand your vocabulary effortlessly.", ageGroup: "teens" },
    { type: "quote", content: "It does not matter how slowly you go as long as you do not stop. — Confucius", ageGroup: "teens" },
    { type: "fact", content: "Turtles can breathe through their butts.", ageGroup: "teens" },
    { type: "reading", content: "The Great Wall of China is not visible from space with the naked eye, despite the popular myth.", ageGroup: "teens" },
    { type: "tip", content: "Backup your photos and files regularly to avoid losing them accidentally.", ageGroup: "teens" },
    { type: "quote", content: "Success usually comes to those who are too busy to be looking for it. — Henry David Thoreau", ageGroup: "teens" },
    { type: "fact", content: "Your brain generates enough electricity to power a small light bulb.", ageGroup: "teens" },
    { type: "tip", content: "Learning basic coding skills can open many career opportunities in the future.", ageGroup: "teens" },
    { type: "reading", content: "The internet sends millions of emails every second, connecting people across the globe instantly.", ageGroup: "teens" },
    { type: "fact", content: "The human brain processes images 60,000 times faster than text.", ageGroup: "teens" },


    // ADULTS
    { type: "quote", content: "Patience is not the ability to wait, but the ability to stay positive while waiting.", ageGroup: "adults" },
    { type: "info", content: "Aadhaar update can now be done online for some fields. Visit the official portal for details on correcting your address or date of birth.", ageGroup: "adults" },
    { type: "tip", content: "To reduce eye strain when working, follow the 20-20-20 rule: every 20 minutes, look at something 20 feet away for at least 20 seconds.", ageGroup: "adults" },
    { type: "poetry", content: "Two roads diverged in a wood, and I— I took the one less traveled by, And that has made all the difference. — Robert Frost", ageGroup: "adults" },
    { type: "info", content: "Most government offices are now moving towards paperless systems. Always check if you can submit documents digitally first.", ageGroup: "adults" },
    { type: "tip", content: "Drinking a glass of water right after waking up helps jumpstart your metabolism.", ageGroup: "adults" },
    { type: "fact", content: "The shortest war in history lasted only 38 minutes between Britain and Zanzibar in 1896.", ageGroup: "adults" },
    { type: "quote", content: "The only limit to our realization of tomorrow will be our doubts of today. — Franklin D. Roosevelt", ageGroup: "adults" },
    { type: "tip", content: "Cooking at home can save you thousands of dollars a year and is generally much healthier.", ageGroup: "adults" },
    { type: "info", content: "Did you know that you can track your public grievances online through the official portal?", ageGroup: "adults" },
    { type: "quote", content: "Do not wait for the perfect time and place to enter, for you are already onstage. — Unknown", ageGroup: "adults" },
    { type: "fact", content: "The average human spends about five years of their life waiting in lines and traffic.", ageGroup: "adults" },
    { type: "tip", content: "Stretching for just five minutes every hour can reduce body stiffness and improve circulation.", ageGroup: "adults" },
    { type: "reading", content: "Digital identity systems are helping governments deliver services faster and more efficiently.", ageGroup: "adults" },
    { type: "info", content: "You can now access many government services online without visiting offices physically.", ageGroup: "adults" },


    // SENIORS
    { type: "tip", content: "Stay active: A simple 15-minute walk daily can significantly improve your heart health and mood.", ageGroup: "seniors" },
    { type: "fact", content: "The world's oldest known tree is a Great Basin bristlecone pine located in California, estimated to be over 4,800 years old!", ageGroup: "seniors" },
    { type: "quote", content: "You are never too old to set another goal or to dream a new dream. — C.S. Lewis", ageGroup: "seniors" },
    { type: "reading", content: "Meditation and puzzles like Sudoku or crosswords are excellent ways to maintain cognitive health as we age.", ageGroup: "seniors" },
    { type: "tip", content: "Regular social interaction is as important for your health as a good diet.", ageGroup: "seniors" },
    { type: "fact", content: "The Eiffel Tower can be 15 cm taller during the summer due to thermal expansion of the iron.", ageGroup: "seniors" },
    { type: "quote", content: "Life is what happens when you're busy making other plans. — John Lennon", ageGroup: "seniors" },
    { type: "tip", content: "Keep a small notepad by your bed to jot down things you don't want to forget in the morning.", ageGroup: "seniors" },
    { type: "reading", content: "Drinking green tea is linked to improved brain function and fat loss, among other impressive benefits.", ageGroup: "seniors" },
    { type: "fact", content: "A cloud can weigh as much as a million pounds.", ageGroup: "seniors" },
    { type: "quote", content: "Count your age by friends, not years. Count your life by smiles, not tears. — John Lennon", ageGroup: "seniors" },
    { type: "fact", content: "Walking regularly can reduce the risk of heart disease by up to 30 percent.", ageGroup: "seniors" },
    { type: "tip", content: "Drinking warm water in the morning can improve digestion.", ageGroup: "seniors" },
    { type: "reading", content: "Listening to music from your youth can help stimulate memory and improve mood.", ageGroup: "seniors" },
    { type: "fact", content: "Laughter boosts the immune system and helps relieve stress.", ageGroup: "seniors" }
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/queuepro');

        console.log("Connected to MongoDB");

        await Puzzle.deleteMany({});
        await EngagementContent.deleteMany({});
        console.log("Cleared existing engagement data.");

        await Puzzle.insertMany(puzzles);
        await EngagementContent.insertMany(contentItems);

        console.log(`Successfully seeded ${puzzles.length} puzzles and ${contentItems.length} content items.`);

        process.exit(0);
    } catch (err) {
        console.error("Error seeding data:", err);
        process.exit(1);
    }
}

seed();
