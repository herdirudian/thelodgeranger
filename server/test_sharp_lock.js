const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function testSharpLock() {
    console.log("Testing sharp file locking...");
    const filePath = path.resolve('test_lock_image.jpg');
    
    // Create a dummy image
    const testImage = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64'
    );
    fs.writeFileSync(filePath, testImage);

    try {
        sharp.cache(false);
        console.log("Reading file into buffer with sharp...");
        
        // Simulate middleware logic
        const buffer = await sharp(filePath)
            .resize({ width: 800, withoutEnlargement: true })
            .jpeg({ quality: 80, mozjpeg: true })
            .toBuffer();
            
        console.log("Buffer created. Size:", buffer.length);
        
        console.log("Attempting to overwrite original file...");
        fs.writeFileSync(filePath, buffer);
        
        console.log("Overwrite successful!");
    } catch (error) {
        console.error("FAILED:", error.message);
    } finally {
        // Cleanup
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                console.log("Cleanup successful");
            } catch (e) {
                console.error("Cleanup failed:", e.message);
            }
        }
    }
}

testSharpLock();
