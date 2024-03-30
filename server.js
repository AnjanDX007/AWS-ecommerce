const http = require('http');
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
require('dotenv').config();


// Configure AWS credentials (replace with your own)
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION, 
});

const s3 = new AWS.S3();
const bucketArn = process.env.S3_BUCKET_ARN; 

async function listObjects(bucketArn) {
    try {
        const data = await s3.listObjectsV2({ Bucket: bucketArn }).promise();
        return data.Contents;
    } catch (error) {
        console.error('Error listing objects:', error);
        throw error;
    }
}

async function downloadImage(bucketArn, key, outputPath) {
    try {
        const params = { Bucket: bucketArn, Key: key };
        const data = await s3.getObject(params).promise();
        fs.writeFileSync(outputPath, data.Body);
        console.log(`Downloaded ${key} to ${outputPath}`);
    } catch (error) {
        console.error(`Error downloading ${key}:`, error);
    }
}

const server = http.createServer(async (req, res) => {
    if (req.url === '/images') {
        // Handle requests to the /images endpoint
        const objects = await listObjects(bucketArn);
        const imageUrls = objects
            .filter(obj => obj.Key.endsWith('.jpg') || obj.Key.endsWith('.png'))
            .map(obj => `http://localhost:8000/${obj.Key}`);

        // Read the HTML template file
        fs.readFile(path.join(__dirname, 'template.html'), 'utf8', (err, htmlTemplate) => {
            if (err) {
                console.error('Error reading HTML template:', err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error');
                return;
            }

            // Generate HTML code for images
            let imagesHTML = '';
            imageUrls.forEach(url => {
                imagesHTML += `
                    <div class="col-sm-4">
                        <div class="panel panel-primary">
                            <div class="panel-heading">Image</div>
                            <div class="panel-body">
                                <img src="${url}" class="img-responsive" style="width:100%" alt="Image">
                            </div>
                            <div class="panel-footer">Description</div>
                        </div>
                    </div>`;
            });

            // Insert dynamic image panels into the HTML template
            const htmlResponse = htmlTemplate.replace('<!-- INSERT_IMAGES_HERE -->', imagesHTML);

            // Send HTML response
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(htmlResponse);
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

server.listen(8000, () => {
    console.log('Server running at http://localhost:8000/');
});
