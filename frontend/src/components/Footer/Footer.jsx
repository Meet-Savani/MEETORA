import React, { useState } from 'react'
import '../../styles/Footer.scss'
import { 
    LocationOn, 
    LocalPhone, 
    Email, 
    Send, 
    Facebook, 
    Twitter, 
    Instagram, 
    LinkedIn, 
    Pinterest,
    CheckCircleOutline
} from '@mui/icons-material'

const Footer = () => {
    const [email, setEmail] = useState('')
    const [subscribed, setSubscribed] = useState(false)
    const [error, setError] = useState('')

    const handleSubscribe = (e) => {
        e.preventDefault()
        if (!email) {
            setError('Please enter a valid email address.')
            return
        }
        
        // Simple regex check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            setError('Please enter a valid email address.')
            return
        }

        setError('')
        setSubscribed(true)
        setEmail('')
        
        // Auto-dismiss the success state after 4 seconds
        setTimeout(() => {
            setSubscribed(false)
        }, 4000)
    }

    return (
        <footer className="footer-container">
            <div className="footer-main">
                {/* Brand Pitch & Socials */}
                <div className="footer-section brand-section">
                    <a href="/" className="footer-logo">
                        <img src="/assets/logo-dark.png" alt="MEETORA Logo" />
                    </a>
                    <p className="brand-pitch">
                        Discover the perfect place to call home. MEETORA connects hosts and travelers with exceptional spaces tailored to every stay, combining comfort, safety, and modern design.
                    </p>
                    <div className="social-icons">
                        <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="social-icon" aria-label="Facebook">
                            <Facebook />
                        </a>
                        <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="social-icon" aria-label="Twitter">
                            <Twitter />
                        </a>
                        <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="social-icon" aria-label="Instagram">
                            <Instagram />
                        </a>
                        <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="social-icon" aria-label="LinkedIn">
                            <LinkedIn />
                        </a>
                        <a href="https://pinterest.com" target="_blank" rel="noopener noreferrer" className="social-icon" aria-label="Pinterest">
                            <Pinterest />
                        </a>
                    </div>
                </div>

                {/* Explore & Company Beside Each Other */}
                <div className="footer-links-group">
                    {/* Explore Columns */}
                    <div className="footer-section links-section explore-section">
                        <h3>Explore</h3>
                        <ul>
                            <li><a href="/properties?category=Apartment">Apartments</a></li>
                            <li><a href="/properties?category=Villa">Villas</a></li>
                            <li><a href="/properties?category=Condo">Condos</a></li>
                            <li><a href="/properties?category=Cabin">Cabins & Cottages</a></li>
                        </ul>
                    </div>

                    {/* Company Columns */}
                    <div className="footer-section links-section company-section">
                        <h3>Company</h3>
                        <ul>
                            <li><a href="/about">About Us</a></li>
                            <li><a href="/careers">Careers</a></li>
                            <li><a href="/terms">Terms and Conditions</a></li>
                            <li><a href="/privacy">Privacy Policy</a></li>
                        </ul>
                    </div>
                </div>

                {/* Newsletter & Contact */}
                <div className="footer-section newsletter-section">
                    <h3>Stay Connected</h3>
                    <p className="newsletter-text">Subscribe to our newsletter for exclusive offers and updates.</p>
                    
                    <form onSubmit={handleSubscribe} className="newsletter-form">
                        <input 
                            type="email" 
                            placeholder="Your email address" 
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value)
                                if (error) setError('')
                            }}
                            className={error ? 'input-error' : ''}
                        />
                        <button type="submit" aria-label="Subscribe">
                            <Send />
                        </button>
                    </form>

                    {error && <p className="newsletter-error">{error}</p>}
                    {subscribed && (
                        <div className="newsletter-success">
                            <CheckCircleOutline sx={{ fontSize: 18 }} />
                            <span>Successfully subscribed! Check your inbox.</span>
                        </div>
                    )}

                    <div className="contact-details">
                        <div className="contact-item">
                            <LocalPhone sx={{ fontSize: 18 }} />
                            <a href="tel:+1234567890">+1 234 567 890</a>
                        </div>
                        <div className="contact-item">
                            <Email sx={{ fontSize: 18 }} />
                            <a href="mailto:meetora@gmail.com">meetora@gmail.com</a>
                        </div>
                        <div className="contact-item">
                            <LocationOn sx={{ fontSize: 18 }} />
                            <span>123 Dream Ave, Suite 400, USA</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="footer-bottom">
                <div className="footer-bottom-divider"></div>
                <div className="footer-bottom-content">
                    <p className="copyright">&copy; {new Date().getFullYear()} MEETORA. All rights reserved.</p>
                    <div className="payment-badges">
                        <img src="/assets/payment.png" alt="Accepted Payment Methods" />
                    </div>
                </div>
            </div>
        </footer>
    )
}

export default Footer
