require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());
app.use(cors());

// Connect to MongoDB
// Note: Newer versions of Mongoose don't need useNewUrlParser or useUnifiedTopology
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected Successfully"))
    .catch(err => console.log("MongoDB Connection Error: ", err));

// --- Schemas ---
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

const TaskSchema = new mongoose.Schema({
    userId: String,
    localId: String, 
    title: String,
    type: String, 
    schedule: Array, 
    lastCompleted: Date
});
const Task = mongoose.model('Task', TaskSchema);

// --- Routes ---
app.post('/api/auth', async (req, res) => {
    const { username, password } = req.body;
    let user = await User.findOne({ username });
    
    if (!user) {
        const hashedPassword = await bcrypt.hash(password, 10);
        user = await User.create({ username, password: hashedPassword });
    } else {
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, userId: user._id });
});

app.post('/api/sync', async (req, res) => {
    const { token, tasks } = req.body; 
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        await Task.deleteMany({ userId: decoded.id });
        const tasksToSave = tasks.map(t => ({ ...t, userId: decoded.id }));
        await Task.insertMany(tasksToSave);
        res.json({ success: true, message: "Backup complete" });
    } catch (err) {
        res.status(401).json({ error: "Unauthorized or Token Expired" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));