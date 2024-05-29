import AwsS3 from '@uppy/aws-s3';
import Uppy from '@uppy/core';
import { Dashboard } from '@uppy/react';
import axios from 'axios';
import { useMemo } from 'react';
import '@uppy/image-editor/dist/style.css';
import '@uppy/core/dist/style.css';
import '@uppy/dashboard/dist/style.css';
import '@uppy/webcam/dist/style.min.css';
import ImageEditor from '@uppy/image-editor';
import Webcam from '@uppy/webcam';

const renameFileName = (originalName, extension, date) => {
	const fileName =
		originalName.split('.').length > 1
			? originalName.split('.').slice(0, -1).join('.')
			: originalName;
	const cleanedFileName = fileName.replace(/[^\w\s]/gi, '-');
	return `${cleanedFileName}-${date}.${extension}`;
};
async function getUploadParameters(file) {
	console.log(file);
	// const fileName;
	const extension = file.extension;
	const previewName =
		file.meta.name.split('.').length > 1
			? `${file.meta.name.split('.').slice(0, -1).join('.')}.${extension}`
			: `${file.meta.name}.${extension}`;
	const uploadStartedAt = file.progress.uploadStarted;
	const metadata = {
		orignalName: file.name,
		previewName: previewName,
		currentName: renameFileName(previewName, extension, uploadStartedAt),
		type: file.type,
		size: file.size,
		extension: extension,
		uploadStarted: new Date(uploadStartedAt).toISOString(),
	};
	const { data, status } = await axios.post('http://localhost:3001/upload/s3', {
		fileName: metadata.currentName,
		filePath: 'resources',
		contentType: file.type,
		// metadata: metadata,
	});
	if (status !== 200) throw new Error('Unsuccessful request');
	// Return an object in the correct shape.
	const object = {
		method: data.method,
		url: data.url,
		fields: {},
		headers: {
			'Content-Type': file.type ? file.type : 'application/octet-stream',
		},
	};
	return object;
}

const FileUpload = ({ onUploadSuccess }) => {
	console.log(renameFileName('a7a', 'jpeg', 123123));
	const dashboardMeta = [{ id: 'name', name: 'Name' }];
	const uppy = useMemo(() => {
		const uppy = new Uppy({
			// autoProceed: true,
			restrictions: {
				maxNumberOfFiles: 1,
				allowedFileTypes: ['image/*'],
			},
		})
			.use(Webcam, {
				mobileNativeCamera: true,
				// countdown: 3,
			})
			.use(AwsS3, {
				id: 'AwsS3',
				getUploadParameters: (file) => getUploadParameters(file),
			})
			.use(ImageEditor, {});
		return uppy;
	}, []);

	uppy.on('complete', (result) => {
		onUploadSuccess(result);
		// write logic after success
	});
	return (
		<Dashboard
			style={{ width: '100%' }}
			uppy={uppy}
			plugins={['Webcam']}
			metaFields={dashboardMeta}
			showLinkToFileUploadResult={true}
		/>
	);
};
export default FileUpload;
