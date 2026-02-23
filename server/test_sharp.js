const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function testSharp() {
    console.log("Testing sharp...");
    try {
        const testImage = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            'base64'
        );
        const inputPath = 'test_input.png';
        const outputPath = 'test_output.jpg';

        fs.writeFileSync(inputPath, testImage);

        await sharp(inputPath)
            .resize(100)
            .jpeg()
            .toFile(outputPath);
            
        console.log("Sharp compression successful!");
        
        // Clean up
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
    } catch (error) {
        console.error("Sharp test failed:", error);
    }
}

testSharp();
