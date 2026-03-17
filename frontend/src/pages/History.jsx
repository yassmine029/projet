
import { useEffect, useState } from 'react'
import { fetchHistory } from '../api'
export default function History(){
  const [rows,setRows] = useState([])
  useEffect(()=>{ fetchHistory().then(r=>setRows(r.data)).catch(()=>{}) },[])
  return (
    <div className='card'>
      <h3>History</h3>
      <table style={{width:'100%'}}>
        <thead><tr><th>Job</th><th>Patient</th><th>Ref</th><th>Pat</th></tr></thead>
        <tbody>{rows.map(r=>(<tr key={r.jobId}><td>{r.jobId}</td><td>{r.patient_id}</td><td>{r.ref}</td><td>{r.patient}</td></tr>))}</tbody>
      </table>
    </div>
  )
}
