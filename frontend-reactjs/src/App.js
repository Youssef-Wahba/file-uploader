import './App.css';
import FileUpload from './components/FileUpload';
import MultipartUpload from './components/MutlipartUpload';
import QrScanner from './components/QrScanner';

function App() {
	// return () => {
	// 	// Clean up event listeners when component unmounts
	// 	uppy.off('complete', onComplete);
	// 	uppy.off('upload-success', onUploadSuccess);
	// };

	return (
		<div className="App">
			{/* <Uploader /> */}
			{/* <FileUpload
				onUploadSuccess={(result) => console.log(JSON.stringify(result))}
			/> */}
			<MultipartUpload
				onUploadSuccess={(result) => console.log(JSON.stringify(result))}
			/>
			{/* <QrScanner /> */}
		</div>
	);
}

export default App;
