import express from 'express';
import { config } from 'dotenv';
import {
	S3Client,
	AbortMultipartUploadCommand,
	CompleteMultipartUploadCommand,
	CreateMultipartUploadCommand,
	ListPartsCommand,
	PutObjectCommand,
	UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import cors from 'cors';
import { GetFederationTokenCommand, STSClient } from '@aws-sdk/client-sts';

config();
const {
	PORT,
	S3_REGION,
	S3_ACCESS_KEY_ID,
	S3_SECRET_ACCESS_KEY,
	S3_ENDPOINT,
	S3_BUCKET,
} = process.env;
const port = PORT || 3000;
const app = express();

app.use(cors());
app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

const S3 = new S3Client({
	region: S3_REGION,
	credentials: {
		accessKeyId: S3_ACCESS_KEY_ID,
		secretAccessKey: S3_SECRET_ACCESS_KEY,
	},
	endpoint: S3_ENDPOINT,
});

app.post('/upload/s3', async (req, res) => {
	const { filePath, fileName, contentType, metadata } = req.body;
	console.log({ filePath, fileName, contentType, metadata });
	if (!filePath || !fileName || !contentType)
		return res.status(400).json({ message: 'bad request' });
	const params = {
		Bucket: S3_BUCKET,
		Key: `${filePath}/${fileName}`,
		ContentType: contentType,
		Metadata: { ...metadata },
	};
	const signedUrl = await getSignedUrl(
		S3,
		new PutObjectCommand({ ...params }, { expiresIn: 3600 })
	);
	res.setHeader('Access-Control-Allow-Origin', '*');
	return res.status(200).json({
		url: signedUrl,
		method: 'PUT',
	});
});

// app.post('/sign-s3', async (req, res, next) => {
// 	console.log('Sign s3:');
// 	const Key = `${crypto.randomUUID()}-${req.body.filename}`;
// 	const { contentType } = req.body;
// 	const url = await getSignedUrl(
// 		S3,
// 		new PutObjectCommand({
// 			Bucket: S3_BUCKET,
// 			Key,
// 			ContentType: contentType,
// 		}),
// 		{ expiresIn }
// 	);
// 	res.setHeader('Access-Control-Allow-Origin', '*');
// 	return res.status(200).json({
// 		url,
// 		method: 'PUT',
// 	});
// });

app.post('/upload/s3/multipart', async (req, res) => {
	const { fileName, contentType, metadata } = req.body;
	if (!fileName || !contentType) {
		console.log({ fileName, contentType });
		return res.status(400).json({ message: 'bad request' });
	}
	console.log('multipart: ', { fileName, contentType, metadata });
	try {
		const params = {
			Bucket: S3_BUCKET,
			Key: fileName,
			ContentType: contentType,
			Metadata: { ...metadata },
		};
		const command = new CreateMultipartUploadCommand({ ...params });
		const { UploadId, Key } = await S3.send(command);
		return res.status(200).json({
			uploadId: UploadId,
			key: Key,
		});
	} catch (err) {
		console.log('Error', err);
		return res.status(500).json({ status: 500 });
	}
});

// app.get('/upload/s3/multipart/:uploadId/:partNumber', (req, res) => {
// 	const { uploadId, partNumber } = req.params;
// 	const { key } = req.query;

// 	if (!validatePartNumber(partNumber)) {
// 		return res.status(400).json({
// 			error: 's3: the part number must be an integer between 1 and 10000.',
// 		});
// 	}
// 	if (typeof key !== 'string') {
// 		return res.status(400).json({
// 			error:
// 				's3: the object key must be passed as a query parameter. For example: "?key=abc.jpg"',
// 		});
// 	}

// 	return getSignedUrl(
// 		S3,
// 		new UploadPartCommand({
// 			Bucket: S3_BUCKET,
// 			Key: key,
// 			UploadId: uploadId,
// 			PartNumber: partNumber,
// 			Body: '',
// 		}),
// 		{ expiresIn }
// 	).then((url) => {
// 		res.setHeader('Access-Control-Allow-Origin', '*');
// 		return res.json({ url, expires: expiresIn });
// 	});
// });

// app.get('/upload/s3/multipart/:uploadId', (req, res, next) => {
// 	const client = S3;
// 	const { uploadId } = req.params;
// 	const { key } = req.query;

// 	if (typeof key !== 'string') {
// 		res.status(400).json({
// 			error:
// 				's3: the object key must be passed as a query parameter. For example: "?key=abc.jpg"',
// 		});
// 		return;
// 	}

// 	const parts = [];

// 	function listPartsPage(startAt) {
// 		client.send(
// 			new ListPartsCommand({
// 				Bucket: S3_BUCKET,
// 				Key: key,
// 				UploadId: uploadId,
// 				PartNumberMarker: startAt,
// 			}),
// 			(err, data) => {
// 				if (err) return res.status(400).json(err);

// 				parts.push(...data.Parts);

// 				if (data.IsTruncated) {
// 					// Get the next page.
// 					listPartsPage(data.NextPartNumberMarker);
// 				} else {
// 					return res.status(200).json(parts);
// 				}
// 			}
// 		);
// 	}
// 	listPartsPage(0);
// });
app.post('/upload/s3/multipart/prepare-parts', async (req, res) => {
	const { partData } = req.body;
	const { parts } = partData;
	console.log('prepare parts: ', { parts });
	const response = {
		presignedUrls: {},
	};
	const promises = parts.map(async (part) => {
		try {
			const params = {
				Bucket: S3_BUCKET,
				Key: partData.key,
				PartNumber: part.number,
				UploadId: partData.uploadId,
			};
			const command = new UploadPartCommand({ ...params });
			const url = await getSignedUrl(S3, command, { expiresIn: 3600 });
			response.presignedUrls[part.number] = url;
		} catch (err) {
			console.log('Error', err);
			throw err; // Throw the error to be caught by Promise.all
		}
		try {
			await Promise.all(promises);
			console.log(response);
			return res.status(200).json(response);
		} catch (err) {
			return res.status(500).json(err);
		}
	});
});
app.post('/upload/s3/multipart/list-parts', async (req, res) => {
	const { key, uploadId } = req.body;
	console.log('listParts: ', { key, uploadId });
	try {
		const params = {
			Bucket: S3_BUCKET,
			Key: key,
			UploadId: uploadId,
		};
		const command = new ListPartsCommand({ ...params });
		const response = await S3.send(command);
		console.log(response['Parts']);
		return res.status(200).json(response['Parts']);
	} catch (err) {
		console.log('Error', err);
		return res.status(500).json(err);
	}
});
app.post('/upload/s3/multipart/complete', async (req, res) => {
	const { key, uploadId, parts } = req.body;
	console.log('complete: ', { key, uploadId, parts });
	try {
		const params = {
			Bucket: S3_BUCKET,
			Key: key,
			UploadId: uploadId,
			MultipartUpload: { Parts: parts },
		};
		const command = new CompleteMultipartUploadCommand({ ...params });
		const response = await S3.send(command);
		return res.status(200).json(response);
	} catch (err) {
		console.log('Error', err);
		return res.status(500).json(err);
	}
});

app.post('/upload/s3/multipart/abort', async (req, res) => {
	const { key, uploadId } = req.body;
	console.log('abort: ', { key, uploadId });
	try {
		const params = {
			Bucket: S3_BUCKET,
			Key: key,
			UploadId: uploadId,
		};
		const command = new AbortMultipartUploadCommand({ ...params });
		const response = await S3.send(command);
		return res.status(200).json(response);
	} catch (err) {
		console.log('Error', err);
		return res.status(500).json(err);
	}
});

app.post('/upload/s3/multipart/sign-part', async (req, res) => {
	const { key, uploadId } = req.body;
	const partNumber = parseInt(req.body.partNumber);
	console.log('sign part :', { key, uploadId, partNumber });
	const params = {
		Bucket: S3_BUCKET,
		Key: key,
		PartNumber: partNumber,
		UploadId: uploadId,
	};
	const command = new UploadPartCommand({ ...params });
	const url = await getSignedUrl(S3, command, { expiresIn: 3600 });
	return res.status(200).json({
		url: url,
	});
});

// function isValidPart(part) {
// 	return (
// 		part &&
// 		typeof part === 'object' &&
// 		Number(part.PartNumber) &&
// 		typeof part.ETag === 'string'
// 	);
// }

// app.post('/upload/s3/multipart/:uploadId/complete', (req, res, next) => {
// 	const client = S3;
// 	const { uploadId } = req.params;
// 	const { key } = req.query;
// 	const { parts } = req.body;

// 	if (typeof key !== 'string') {
// 		return res.status(400).json({
// 			error:
// 				's3: the object key must be passed as a query parameter. For example: "?key=abc.jpg"',
// 		});
// 	}
// 	if (!Array.isArray(parts) || !parts.every(isValidPart)) {
// 		return res.status(400).json({
// 			error: 's3: `parts` must be an array of {ETag, PartNumber} objects.',
// 		});
// 	}

// 	return client.send(
// 		new CompleteMultipartUploadCommand({
// 			Bucket: S3_BUCKET,
// 			Key: key,
// 			UploadId: uploadId,
// 			MultipartUpload: {
// 				Parts: parts,
// 			},
// 		}),
// 		(err, data) => {
// 			if (err) {
// 				return res.status(400).json(err);
// 			}
// 			res.setHeader('Access-Control-Allow-Origin', '*');
// 			return res.json({
// 				location: data.Location,
// 			});
// 		}
// 	);
// });

// app.delete('/upload/s3/multipart/:uploadId', (req, res, next) => {
// 	const client = S3;
// 	const { uploadId } = req.params;
// 	const { key } = req.query;

// 	if (typeof key !== 'string') {
// 		return res.status(400).json({
// 			error:
// 				's3: the object key must be passed as a query parameter. For example: "?key=abc.jpg"',
// 		});
// 	}

// 	return client.send(
// 		new AbortMultipartUploadCommand({
// 			Bucket: S3_BUCKET,
// 			Key: key,
// 			UploadId: uploadId,
// 		}),
// 		(err) => {
// 			if (err) {
// 				return res.status(400).json(err);
// 			}
// 			res.json({});
// 		}
// 	);
// });

app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
