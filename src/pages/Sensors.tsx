
import React from 'react';
import {db} from '../../firebase';
import {ref, onValue} from 'firebase/database';

const Dashboard: React.FC = () => {
  const [raw, setRaw] = React.useState<number>(0);
  const [voltage, setVoltage] = React.useState<number>(0);

  React.useEffect(() => {
    const potRef = ref(db, 'sensor/potentiometer');

    const unsubscribe = onValue(potRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRaw(data.raw);
        setVoltage(data.voltage);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold mb-2">Sensors</h2>
      <p className="text-gray-600 text-sm">This page mirrors the visual style; add your sensor tables and charts here.</p>
      <p className="text-gray-600 text-sm"> Potentiometer Reading: {voltage.toFixed(2)}</p>
    </div>
  );
};

export default Dashboard
