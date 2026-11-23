import React from 'react'
import '../../styles/Loader.scss'

const Loader = () => {
    return (
        <div className='loader-container'>
            <div className='meetora-loader'>
                <svg className="house-svg" viewBox="0 0 100 100" width="120" height="120">
                    {/* The ground line */}
                    <line className="ground" x1="10" y1="85" x2="90" y2="85" />
                    
                    {/* The main house walls */}
                    <rect className="walls" x="25" y="45" width="50" height="40" rx="2" />
                    
                    {/* The roof */}
                    <polygon className="roof" points="20,45 50,15 80,45" />
                    
                    {/* The chimney */}
                    <rect className="chimney" x="65" y="23" width="8" height="15" />
                    
                    {/* Chimney smoke */}
                    <circle className="smoke smoke-1" cx="69" cy="15" r="3" />
                    <circle className="smoke smoke-2" cx="72" cy="8" r="4" />
                    <circle className="smoke smoke-3" cx="68" cy="2" r="5" />
                    
                    {/* The door */}
                    <rect className="door" x="43" y="60" width="14" height="25" rx="1" />
                    
                    {/* The door handle */}
                    <circle className="handle" cx="53" cy="73" r="1" />
                    
                    {/* The windows */}
                    <rect className="window" x="30" y="52" width="10" height="10" rx="1" />
                    <line className="window-line-h" x1="30" y1="57" x2="40" y2="57" />
                    <line className="window-line-v" x1="35" y1="52" x2="35" y2="62" />

                    <rect className="window" x="60" y="52" width="10" height="10" rx="1" />
                    <line className="window-line-h" x1="60" y1="57" x2="70" y2="57" />
                    <line className="window-line-v" x1="65" y1="52" x2="65" y2="62" />
                </svg>
                <h2 className="loading-text">Finding your MEETORA stay...</h2>
            </div>
        </div>
    )
}

export default Loader