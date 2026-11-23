const router = require('express').Router();

router.get("/google-maps-key", async (req, res) => {
    try {
        // Retrieve the API Key from the environment variables safely
        const key = process.env.GOOGLE_MAPS_API_KEY || "";
        return res.status(200).json({ googleMapsApiKey: key });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

module.exports = router;
