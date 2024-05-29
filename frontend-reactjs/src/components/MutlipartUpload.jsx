import Uppy from '@uppy/core';
import { Dashboard } from '@uppy/react';
import AwsS3Multipart from '@uppy/aws-s3-multipart';

// Uppy styles
import '@uppy/core/dist/style.min.css';
import '@uppy/dashboard/dist/style.min.css';
import axios from 'axios';
import { useMemo } from 'react';

const fetchUploadApiEndpoint = async (endpoint, fileData) => {
	console.log(endpoint);
	console.log(fileData);
	const { data } = await axios.post(
		`http://localhost:3001/upload/s3/multipart/${endpoint}`,
		fileData
	);
	return data;
};

const MultipartUpload = ({ onUploadSuccess }) => {
	const uppy = useMemo(() => {
		const uppy = new Uppy({
			autoProceed: true,
		}).use(AwsS3Multipart, {
			createMultipartUpload: async (file) => {
				const contentType = file.type;
				return fetchUploadApiEndpoint('', {
					fileName: file.name,
					contentType,
					metadata: {},
				});
			},
			listParts: (file, props) =>
				fetchUploadApiEndpoint('list-parts', { file, ...props }),
			signPart: (file, props) =>
				fetchUploadApiEndpoint('sign-part', { file, ...props }),
			abortMultipartUpload: (file, props) =>
				fetchUploadApiEndpoint('abort', { file, ...props }),
			completeMultipartUpload: (file, props) =>
				fetchUploadApiEndpoint('complete', {
					file,
					...props,
				}),
		});
		return uppy;
	}, []);
	uppy.on('complete', (result) => {
		onUploadSuccess(result);
	});
	uppy.on('upload-success', (file, response) => {
		uppy.setFileState(file.id, {
			progress: uppy.getState().files[file.id].progress,
			uploadURL: response.body.Location,
			response: response,
			isPaused: false,
		});
	});
	return <Dashboard uppy={uppy} showLinkToFileUploadResult={true} />;
};
export default MultipartUpload;
