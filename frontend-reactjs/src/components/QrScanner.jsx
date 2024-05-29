import { useState } from 'react';
import { QrReader } from 'react-qr-reader';

const QrScanner = () => {
	const [data, setData] = useState('No result');
	const [selected, setSelected] = useState('environment');
	const [startScan, setStartScan] = useState(false);
	const [loadingScan, setLoadingScan] = useState(false);

	return (
		<>
			<h2>
				Facing mode:
				{selected}
			</h2>
			<p>result: {data}</p>
			<div
				style={{ width: '500px', backgroundColor: 'green', height: '500px' }}
			>
				<button
					onClick={() => {
						setStartScan(!startScan);
						setLoadingScan(!loadingScan);
					}}
				>
					{startScan ? 'Stop Scan' : 'Start Scan'}
				</button>
				{/* <select onChange={(e) => setSelected(e.target.value)}>
					<option value={'environment'}>Back Camera</option>
					<option value={'user'}>Front Camera</option>
				</select> */}
				{startScan && (
					<>
						<select onChange={(e) => setSelected(e.target.value)}>
							<option value={'environment'}>Back Camera</option>
							<option value={'user'}>Front Camera</option>
						</select>
						<QrReader
							constraints={{ facingMode: selected }}
							// facingMode={selected}
							scanDelay={1000}
							onResult={(result, error) => {
								setLoadingScan(true);
								if (!!result) {
									setData(result?.text);
									setStartScan(false);
									setLoadingScan(false);
								}
								if (!!error) console.error(error);
							}}
							// style={{ width: '300px' }}
						/>
					</>
				)}
				{loadingScan && <p>Loading</p>}
			</div>
		</>
	);
};
export default QrScanner;
