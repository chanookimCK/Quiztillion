// Import necessary modules
const express = require("express");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static("public"));
app.use("/problems", express.static("problems"));

// In-memory database for demo
let userAttempts = {}; // Keyed by IP, tracks attempts and success
const problemsDir = path.join(__dirname, "problems");
const indexFilePath = path.join(__dirname, "currentProblemIndex.json");

// Function to load problem data dynamically
function loadProblem(index) {
    const problemPath = path.join(problemsDir, `${index}`);
    try {
        const imagePath = path.join(problemPath, "problem.png");
        const descriptionPath = path.join(problemPath, "description.txt");
        const hintPath = path.join(problemPath, "hint.txt");
        const answerPath = path.join(problemPath, "answer.txt");

        if (!fs.existsSync(imagePath) || !fs.existsSync(descriptionPath) || !fs.existsSync(hintPath) || !fs.existsSync(answerPath)) {
        throw new Error("Problem files are missing");
        }

        return {
        image: `/problems/${index}/problem.png`,
        description: fs.readFileSync(descriptionPath, "utf-8"),
        hint: fs.readFileSync(hintPath, "utf-8"),
        answer: fs.readFileSync(answerPath, "utf-8").trim(),
        };
    } catch (error) {
        console.error(`Error loading problem ${index}:`, error.message);
        return null;
    }
}
  

// Load currentProblemIndex from file
function loadProblemIndex() {
    try {
        const data = fs.readFileSync(indexFilePath, "utf-8");
        const json = JSON.parse(data);
        const index = json.index;

        // Check if the problem folder exists
        if (fs.existsSync(path.join(problemsDir, `${index}`))) {
        return index;
        } else {
        console.error(`Problem folder for index ${index} does not exist. Defaulting to 1.`);
        saveProblemIndex(1);
        return 1; // Default to 1 if folder does not exist
        }
    } catch (error) {
        console.error("Error loading problem index, defaulting to 1:", error.message);
        saveProblemIndex(1);
        return 1; // Default to 1 if file doesn't exist or is invalid
    }
}
  

// Save currentProblemIndex to file
function saveProblemIndex(index) {
  try {
    fs.writeFileSync(indexFilePath, JSON.stringify({ index }));
    console.log("Problem index saved:", index);
  } catch (error) {
    console.error("Error saving problem index:", error.message);
  }
}

// Initialize currentProblemIndex
let currentProblemIndex = loadProblemIndex();

// Serve today's problem
app.get("/api/problem", (req, res) => {
  const problem = loadProblem(currentProblemIndex);
  if (!problem) {
    return res.status(500).json({ message: "Problem not available" });
  }
  res.json({
    image: problem.image,
    description: problem.description,
  });
});

// Serve hint
app.get("/api/hint", (req, res) => {
  const problem = loadProblem(currentProblemIndex);
  if (!problem) {
    return res.status(500).json({ message: "Hint not available" });
  }
  res.json({ hint: problem.hint });
});

// Submit answer
app.post("/api/answer", (req, res) => {
  const userIP = req.ip;
  const { answer, nickname } = req.body;

  if (!userAttempts[userIP]) {
    userAttempts[userIP] = { attempts: 0, success: false, nickname };
  }

  const userData = userAttempts[userIP];

  if (userData.success) {
    return res.status(400).json({ message: "You have already solved today's problem!" });
  }

  if (userData.attempts >= 10) {
    return res.status(400).json({ message: "You have exceeded the maximum number of attempts!" });
  }

  userData.attempts++;

  const problem = loadProblem(currentProblemIndex);
  if (!problem) {
    return res.status(500).json({ message: "Problem not available" });
  }

  if (answer === problem.answer) {
    userData.success = true;
    return res.json({ message: "Correct! You solved the problem!", success: true });
  }

  res.json({ message: "Incorrect answer. Try again!", success: false });
});

// Reset at midnight
cron.schedule("*/1 * * * *", () => {
  console.log("Resetting problem and user attempts...");
  userAttempts = {}; // Clear user attempts

  const nextProblemIndex = currentProblemIndex + 1;
  if (fs.existsSync(path.join(problemsDir, `${nextProblemIndex}`))) {
    currentProblemIndex = nextProblemIndex;
  } else {
    currentProblemIndex = 1; // Loop back to the first problem
  }

  saveProblemIndex(currentProblemIndex); // Save updated index
  console.log("Problem and user attempts reset successfully.");
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
  });

