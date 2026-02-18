// Enhanced Particle System for Hero Background
class ParticleSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.particleCount = 150;
        this.mouse = { x: 0, y: 0 };
        this.mouseRadius = 200;
        
        this.init();
        this.animate();
        this.bindEvents();
    }
    
    init() {
        this.resize();
        this.createParticles();
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    createParticles() {
        this.particles = [];
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                radius: Math.random() * 2.5 + 0.5,
                speedX: (Math.random() - 0.5) * 0.8,
                speedY: (Math.random() - 0.5) * 0.8,
                opacity: Math.random() * 0.6 + 0.2,
                baseOpacity: Math.random() * 0.6 + 0.2
            });
        }
    }
    
    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Update and draw particles
        this.particles.forEach((particle, index) => {
            particle.x += particle.speedX;
            particle.y += particle.speedY;
            
            // Wrap around edges
            if (particle.x < 0) particle.x = this.canvas.width;
            if (particle.x > this.canvas.width) particle.x = 0;
            if (particle.y < 0) particle.y = this.canvas.height;
            if (particle.y > this.canvas.height) particle.y = 0;
            
            // Draw particle
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`;
            this.ctx.fill();
            
            // Draw connections
            this.particles.slice(index + 1).forEach(otherParticle => {
                const dx = particle.x - otherParticle.x;
                const dy = particle.y - otherParticle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 180) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(particle.x, particle.y);
                    this.ctx.lineTo(otherParticle.x, otherParticle.y);
                    const opacity = 0.15 * (1 - distance / 180);
                    this.ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
                    this.ctx.lineWidth = 0.8;
                    this.ctx.stroke();
                }
            });
        });
        
        requestAnimationFrame(() => this.animate());
    }
    
    bindEvents() {
        window.addEventListener('resize', () => {
            this.resize();
            this.createParticles();
        });
        
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
            
            // Attract particles to mouse
            this.particles.forEach(particle => {
                const dx = this.mouse.x - particle.x;
                const dy = this.mouse.y - particle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < this.mouseRadius) {
                    const force = (this.mouseRadius - distance) / this.mouseRadius;
                    particle.speedX += (dx / distance) * force * 0.5;
                    particle.speedY += (dy / distance) * force * 0.5;
                    particle.opacity = Math.min(particle.baseOpacity + force * 0.3, 1);
                } else {
                    particle.opacity = particle.baseOpacity;
                }
                
                // Damping
                particle.speedX *= 0.98;
                particle.speedY *= 0.98;
            });
        });
    }
}

// Enhanced Scroll Animation Observer
class ScrollAnimator {
    constructor() {
        this.elements = document.querySelectorAll('.card, .about-text, .about-visual, .feature-item, .vision-text, .vision-visual, .comparison-table-wrapper, .team-member');
        this.init();
    }
    
    init() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -80px 0px'
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        entry.target.classList.add('visible');
                    }, index * 100);
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);
        
        this.elements.forEach(element => {
            observer.observe(element);
        });
    }
}

// Parallax Scrolling Controller
class ParallaxController {
    constructor() {
        this.elements = document.querySelectorAll('.parallax-element');
        this.scrollY = 0;
        this.init();
    }
    
    init() {
        this.handleScroll = this.handleScroll.bind(this);
        window.addEventListener('scroll', this.handleScroll, { passive: true });
        this.handleScroll();
    }
    
    handleScroll() {
        this.scrollY = window.pageYOffset;
        
        this.elements.forEach(element => {
            const rect = element.getBoundingClientRect();
            const speed = parseFloat(element.dataset.speed) || 0.5;
            const elementTop = rect.top + this.scrollY;
            const elementHeight = rect.height;
            const windowHeight = window.innerHeight;
            
            // Only apply parallax when element is in viewport
            if (rect.bottom >= 0 && rect.top <= windowHeight) {
                const yPos = -(this.scrollY - elementTop + windowHeight / 2) * speed;
                element.style.transform = `translate3d(0, ${yPos}px, 0)`;
            }
        });
    }
    
    destroy() {
        window.removeEventListener('scroll', this.handleScroll);
    }
}

// Navbar Scroll Effect
class NavbarController {
    constructor() {
        this.navbar = document.querySelector('.navbar');
        this.init();
    }
    
    init() {
        let lastScroll = 0;
        
        window.addEventListener('scroll', () => {
            const currentScroll = window.pageYOffset;
            
            if (currentScroll > 100) {
                this.navbar.classList.add('scrolled');
            } else {
                this.navbar.classList.remove('scrolled');
            }
            
            lastScroll = currentScroll;
        });
    }
}

// Mobile Menu Toggle
class MobileMenu {
    constructor() {
        this.hamburger = document.querySelector('.hamburger');
        this.navMenu = document.querySelector('.nav-menu');
        this.navLinks = document.querySelectorAll('.nav-link');
        this.init();
    }
    
    init() {
        this.hamburger.addEventListener('click', () => {
            this.hamburger.classList.toggle('active');
            this.navMenu.classList.toggle('active');
        });
        
        this.navLinks.forEach(link => {
            link.addEventListener('click', () => {
                this.hamburger.classList.remove('active');
                this.navMenu.classList.remove('active');
            });
        });
    }
}

// Smooth Scroll for Anchor Links
class SmoothScroll {
    constructor() {
        this.init();
    }
    
    init() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                
                if (target) {
                    const offsetTop = target.offsetTop - 80;
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }
}

// Button Ripple Effect
class RippleEffect {
    constructor() {
        this.buttons = document.querySelectorAll('.btn');
        this.init();
    }
    
    init() {
        this.buttons.forEach(button => {
            button.addEventListener('click', function(e) {
                const ripple = document.createElement('span');
                const rect = this.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;
                
                ripple.style.width = ripple.style.height = size + 'px';
                ripple.style.left = x + 'px';
                ripple.style.top = y + 'px';
                ripple.classList.add('ripple');
                
                this.appendChild(ripple);
                
                setTimeout(() => {
                    ripple.remove();
                }, 600);
            });
        });
    }
}

// Enhanced Card Tilt Effect
class CardTilt {
    constructor() {
        this.cards = document.querySelectorAll('.card');
        this.init();
    }
    
    init() {
        this.cards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                
                const rotateX = (y - centerY) / 12;
                const rotateY = (centerX - x) / 12;
                
                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-15px) scale(1.03)`;
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
            });
        });
    }
}

// Cinematic Scroll Progress Indicator
class ScrollProgress {
    constructor() {
        this.progressBar = null;
        this.init();
    }
    
    init() {
        // Create progress bar
        this.progressBar = document.createElement('div');
        this.progressBar.className = 'scroll-progress';
        this.progressBar.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 0%;
            height: 3px;
            background: linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,255,255,0.4));
            z-index: 10000;
            transition: width 0.1s ease-out;
            box-shadow: 0 0 10px rgba(255,255,255,0.5);
        `;
        document.body.appendChild(this.progressBar);
        
        window.addEventListener('scroll', () => {
            const windowHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrolled = (window.pageYOffset / windowHeight) * 100;
            this.progressBar.style.width = scrolled + '%';
        }, { passive: true });
    }
}

// Radar Chart for Model Performance Section
class ModelRadarChart {
    constructor(canvas, tooltipEl, legendItems) {
        if (!canvas) return;

        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.tooltipEl = tooltipEl;
        this.legendItems = legendItems;

        this.labels = ['Accuracy', 'Efficiency', 'Speed', 'Stability', 'Scalability'];
        this.datasets = [
            { name: 'LLM', values: [70, 20, 10, 55, 75], color: '#b4b4b4' },
            { name: 'GAN', values: [60, 35, 50, 45, 30], color: '#777777' },
            { name: 'GPM', values: [95, 80, 60, 60, 70], color: '#ffffff' }
        ];

        this.maxValue = 100;
        this.levels = 5;
        this.progress = 0;
        this.hoveredDataset = null;
        this.hoveredLabelIndex = null;
        this.legendHoverIndex = null;

        this.centerX = 0;
        this.centerY = 0;
        this.radius = 0;
        this.pixelRatio = window.devicePixelRatio || 1;

        this.activated = false;

        this.floatingPhase = 0;
        this.stars = [];
        this.shootingStars = [];
        this.hoverLerp = 0;
        this.cursorX = 0;
        this.cursorY = 0;

        this.handleResize = this.handleResize.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseLeave = this.handleMouseLeave.bind(this);

        this.init();
    }

    init() {
        this.setupCanvasSize();
        this.cursorX = this.centerX;
        this.cursorY = this.centerY;
        this.createStars();
        this.bindEvents();
        this.animate();
        this.setupIntersectionObserver();
    }

    setupCanvasSize() {
        const rect = this.canvas.getBoundingClientRect();
        const maxSize = 560;
        const size = Math.min(Math.max(rect.width || maxSize, 280), maxSize);
        this.canvas.width = size * this.pixelRatio;
        this.canvas.height = size * this.pixelRatio;
        this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);

        this.centerX = size / 2;
        this.centerY = size / 2;
        this.radius = (size / 2) * 0.70;
    }

    bindEvents() {
        window.addEventListener('resize', this.handleResize, { passive: true });
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave);

        if (this.legendItems) {
            this.legendItems.forEach((item, index) => {
                item.addEventListener('mouseenter', () => {
                    this.legendHoverIndex = index;
                    this.updateLegendClasses();
                });
                item.addEventListener('mouseleave', () => {
                    this.legendHoverIndex = null;
                    this.updateLegendClasses();
                });
                item.addEventListener('click', () => {
                    this.hoveredDataset = this.hoveredDataset === index ? null : index;
                });
            });
        }
    }

    setupIntersectionObserver() {
        const container = this.canvas.closest('.model-performance-inner');
        if (!container) return;

        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    container.classList.add('visible');
                    const section = document.getElementById('model-performance');
                    if (section) section.classList.add('chart-visible');
                    this.activated = true;
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -80px 0px' });

        observer.observe(container);
    }

    handleResize() {
        this.setupCanvasSize();
    }

    handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left);
        const y = (event.clientY - rect.top);
        this.cursorX = x;
        this.cursorY = y;
        this.detectHover(x, y);
    }

    handleMouseLeave() {
        this.hoveredDataset = null;
        this.hoveredLabelIndex = null;
        this.cursorX = this.centerX;
        this.cursorY = this.centerY;
        if (this.tooltipEl) {
            this.tooltipEl.classList.remove('visible');
        }
    }

    getCursorParallax() {
        const dx = this.cursorX - this.centerX;
        const dy = this.cursorY - this.centerY;
        const scale = 0.012;
        const max = 2;
        return {
            x: Math.max(-max, Math.min(max, dx * scale)),
            y: Math.max(-max, Math.min(max, dy * scale))
        };
    }

    createStars() {
        this.stars = [];
        const width = this.canvas.width / this.pixelRatio;
        const height = this.canvas.height / this.pixelRatio;
        const baseCount = width < 480 ? 40 : 80;

        for (let i = 0; i < baseCount; i++) {
            this.stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                radius: Math.random() * 1.2 + 0.3,
                twinkleOffset: Math.random() * Math.PI * 2
            });
        }
    }

    maybeSpawnShootingStar(timestamp) {
        if (!this.lastShootingTime) {
            this.lastShootingTime = timestamp;
            return;
        }
        const elapsed = timestamp - this.lastShootingTime;
        const interval = 5000 + Math.random() * 5000;
        if (elapsed > interval) {
            const width = this.canvas.width / this.pixelRatio;
            const height = this.canvas.height / this.pixelRatio;
            const startX = Math.random() * width * 0.3;
            const startY = Math.random() * height * 0.3;
            const speed = 0.4 + Math.random() * 0.25;

            this.shootingStars.push({
                x: startX,
                y: startY,
                vx: speed,
                vy: speed * 0.6,
                life: 0,
                maxLife: 1.4
            });

            this.lastShootingTime = timestamp;
        }
    }

    drawStars(time) {
        const ctx = this.ctx;
        const width = this.canvas.width / this.pixelRatio;
        const height = this.canvas.height / this.pixelRatio;

        ctx.save();
        // No fill – canvas stays transparent so section starfield blends through

        this.stars.forEach(star => {
            const twinkle = 0.5 + 0.5 * Math.sin(time * 0.0012 + star.twinkleOffset);
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${0.06 * twinkle})`;
            ctx.fill();
        });

        this.shootingStars = this.shootingStars.filter(s => s.life < s.maxLife);
        this.shootingStars.forEach(star => {
            star.x += star.vx;
            star.y += star.vy;
            star.life += 0.016;
            const t = star.life / star.maxLife;
            const alpha = (1 - t) * 0.2;

            ctx.beginPath();
            ctx.moveTo(star.x, star.y);
            ctx.lineTo(star.x - 40, star.y - 20);
            ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        ctx.restore();
    }

    polarToCartesian(angleIndex, valueFactor) {
        const step = (Math.PI * 2) / this.labels.length;
        const angle = step * angleIndex - Math.PI / 2;
        const x = this.centerX + this.radius * valueFactor * Math.cos(angle);
        const y = this.centerY + this.radius * valueFactor * Math.sin(angle);
        return { x, y };
    }

    drawGrid() {
        const ctx = this.ctx;
        const par = this.getCursorParallax();
        ctx.save();
        ctx.translate(par.x, par.y);
        ctx.translate(0, this.getFloatingOffset());
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';

        for (let level = 1; level <= this.levels; level++) {
            const rFactor = (level / this.levels) * this.progress;
            ctx.beginPath();
            for (let i = 0; i < this.labels.length; i++) {
                const { x, y } = this.polarToCartesian(i, rFactor);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        for (let i = 0; i < this.labels.length; i++) {
            const { x, y } = this.polarToCartesian(i, this.progress);
            ctx.beginPath();
            ctx.moveTo(this.centerX, this.centerY + this.getFloatingOffset());
            ctx.lineTo(x, y);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawLabels() {
        const ctx = this.ctx;
        const par = this.getCursorParallax();
        const hasHover = this.hoveredDataset !== null || this.legendHoverIndex !== null;
        const labelOpacity = hasHover ? 0.5 + this.hoverLerp * 0.38 : 0.72;
        ctx.save();
        ctx.translate(par.x, par.y);
        ctx.translate(0, this.getFloatingOffset());
        ctx.font = '400 13px "Lato", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const labelRadius = this.radius * 1.08;

        if (hasHover) {
            ctx.shadowColor = 'rgba(255,255,255,0.4)';
            ctx.shadowBlur = 2;
        }
        for (let i = 0; i < this.labels.length; i++) {
            const step = (Math.PI * 2) / this.labels.length;
            const angle = step * i - Math.PI / 2;
            const x = this.centerX + labelRadius * Math.cos(angle);
            const y = this.centerY + labelRadius * Math.sin(angle);

            ctx.fillStyle = `rgba(255,255,255,${labelOpacity})`;
            ctx.fillText(this.labels[i], x, y);
        }
        ctx.shadowBlur = 0;

        ctx.restore();
    }

    drawDataset(dataset, index) {
        const ctx = this.ctx;
        const isHovered = this.hoveredDataset === index || this.legendHoverIndex === index;
        const globalDim = this.legendHoverIndex !== null && !isHovered;

        const baseAlpha = index === 2 ? 0.14 : 0.1;
        const strokeBase = globalDim ? 0.2 : 0.45;
        const fillBase = globalDim ? baseAlpha * 0.5 : baseAlpha;
        const fillAlpha = fillBase + (isHovered ? this.hoverLerp * 0.08 : 0);
        const strokeAlpha = strokeBase + (isHovered ? this.hoverLerp * 0.2 : 0);
        const lineWidth = isHovered ? 1 + this.hoverLerp * 0.25 : 1;

        const par = this.getCursorParallax();
        ctx.save();
        ctx.translate(par.x, par.y);
        ctx.translate(0, this.getFloatingOffset());

        if (isHovered && this.hoverLerp > 0.1) {
            ctx.shadowColor = this.hexToRgba(dataset.color, 0.5);
            ctx.shadowBlur = 4 + this.hoverLerp * 4;
        }

        ctx.beginPath();
        dataset.values.forEach((value, i) => {
            const easedProgress = this.getEasedProgress();
            const factor = (value / this.maxValue) * easedProgress;
            const point = this.polarToCartesian(i, factor);
            if (i === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });

        ctx.closePath();

        ctx.fillStyle = this.hexToRgba(dataset.color, Math.min(1, fillAlpha));
        ctx.strokeStyle = this.hexToRgba(dataset.color, Math.min(1, strokeAlpha));
        ctx.lineWidth = lineWidth;
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.restore();
    }

    detectHover(x, y) {
        const rect = this.canvas.getBoundingClientRect();
        const localX = x;
        const localY = y;

        const ctx = this.ctx;
        this.hoveredDataset = null;
        this.hoveredLabelIndex = null;

        // Detect dataset under cursor using hit-testing
        for (let d = this.datasets.length - 1; d >= 0; d--) {
            const dataset = this.datasets[d];
            ctx.save();
            ctx.beginPath();
            dataset.values.forEach((value, i) => {
                const factor = (value / this.maxValue) * this.progress;
                const pt = this.polarToCartesian(i, factor);
                const offsetY = this.getFloatingOffset();
                const px = pt.x;
                const py = pt.y + offsetY;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            });
            ctx.closePath();
            if (ctx.isPointInPath(localX * this.pixelRatio, localY * this.pixelRatio)) {
                this.hoveredDataset = d;
                ctx.restore();
                break;
            }
            ctx.restore();
        }

        // Determine closest axis label
        const angle = Math.atan2(localY - (this.centerY + this.getFloatingOffset()), localX - this.centerX);
        const step = (Math.PI * 2) / this.labels.length;
        let index = Math.round((angle + Math.PI / 2) / step);
        index = (index + this.labels.length) % this.labels.length;
        this.hoveredLabelIndex = index;

        this.updateLegendClasses();
        this.updateTooltip(localX, localY);
    }

    updateTooltip(x, y) {
        if (!this.tooltipEl || this.hoveredDataset === null || this.hoveredLabelIndex === null) {
            if (this.tooltipEl) this.tooltipEl.classList.remove('visible');
            return;
        }
        const dataset = this.datasets[this.hoveredDataset];
        const value = dataset.values[this.hoveredLabelIndex];
        const label = this.labels[this.hoveredLabelIndex];

        this.tooltipEl.textContent = `${dataset.name} · ${label}: ${value}`;
        this.tooltipEl.style.left = `${x}px`;
        this.tooltipEl.style.top = `${y}px`;
        this.tooltipEl.classList.add('visible');
    }

    updateLegendClasses() {
        if (!this.legendItems) return;
        this.legendItems.forEach((item, index) => {
            const isDimmed = this.legendHoverIndex !== null && this.legendHoverIndex !== index;
            if (isDimmed) {
                item.classList.add('dimmed');
            } else {
                item.classList.remove('dimmed');
            }
        });
    }

    getFloatingOffset() {
        return Math.sin(this.floatingPhase) * 1.5;
    }

    getEasedProgress() {
        const t = Math.min(this.progress, 1);
        return 1 - Math.pow(1 - t, 2);
    }

    hexToRgba(hex, alpha) {
        const c = hex.replace('#', '');
        const bigint = parseInt(c, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return `rgba(${r},${g},${b},${alpha})`;
    }

    animate(timestamp = performance.now()) {
        const ctx = this.ctx;
        const width = this.canvas.width / this.pixelRatio;
        const height = this.canvas.height / this.pixelRatio;

        const hasHover = this.hoveredDataset !== null || this.legendHoverIndex !== null;
        this.hoverLerp = Math.max(0, Math.min(1, this.hoverLerp + (hasHover ? 0.06 : -0.06)));

        this.floatingPhase += 0.012;
        if (this.activated && this.progress < 1) {
            this.progress += 0.012;
        }

        this.maybeSpawnShootingStar(timestamp);

        ctx.clearRect(0, 0, width, height);
        this.drawStars(timestamp);
        this.drawGrid();
        this.drawLabels();

        this.datasets.forEach((dataset, index) => {
            this.drawDataset(dataset, index);
        });

        requestAnimationFrame((t) => this.animate(t));
    }
}

// Starfield background for Model Performance section
class ModelPerformanceBackground {
    constructor(canvas) {
        if (!canvas) return;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.pixelRatio = window.devicePixelRatio || 1;

        this.stars = [];
        this.shootingStars = [];
        this.lastShootingTime = 0;

        this.handleResize = this.handleResize.bind(this);

        window.addEventListener('resize', this.handleResize, { passive: true });
        this.handleResize();
        this.animate();
    }

    handleResize() {
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width || window.innerWidth;
        const height = rect.height || 400;
        this.canvas.width = width * this.pixelRatio;
        this.canvas.height = height * this.pixelRatio;
        this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
        this.createStars();
    }

    createStars() {
        this.stars = [];
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width || window.innerWidth;
        const height = rect.height || 400;
        const baseCount = width < 640 ? 70 : 120;

        for (let i = 0; i < baseCount; i++) {
            this.stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                radius: Math.random() * 1.2 + 0.4,
                twinkleOffset: Math.random() * Math.PI * 2
            });
        }
    }

    maybeSpawnShootingStar(timestamp) {
        if (!this.lastShootingTime) {
            this.lastShootingTime = timestamp;
            return;
        }
        const elapsed = timestamp - this.lastShootingTime;
        const interval = 5000 + Math.random() * 5000;
        if (elapsed > interval) {
            const rect = this.canvas.getBoundingClientRect();
            const width = rect.width || window.innerWidth;
            const height = rect.height || 400;

            const startX = Math.random() * width * 0.4;
            const startY = Math.random() * height * 0.3;
            const speed = 0.5 + Math.random() * 0.3;

            this.shootingStars.push({
                x: startX,
                y: startY,
                vx: speed,
                vy: speed * 0.5,
                life: 0,
                maxLife: 1.6
            });

            this.lastShootingTime = timestamp;
        }
    }

    drawFrame(timestamp) {
        const ctx = this.ctx;
        const width = this.canvas.width / this.pixelRatio;
        const height = this.canvas.height / this.pixelRatio;

        ctx.clearRect(0, 0, width, height);

        const gradient = ctx.createRadialGradient(
            width * 0.5,
            height * 0.4,
            0,
            width * 0.5,
            height * 0.4,
            Math.max(width, height) * 0.6
        );
        gradient.addColorStop(0, 'rgba(255,255,255,0.04)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        this.stars.forEach(star => {
            const twinkle = 0.5 + 0.5 * Math.sin(timestamp * 0.0012 + star.twinkleOffset);
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${0.06 * twinkle})`;
            ctx.fill();
        });

        this.shootingStars = this.shootingStars.filter(s => s.life < s.maxLife);
        this.shootingStars.forEach(star => {
            star.x += star.vx;
            star.y += star.vy;
            star.life += 0.016;
            const t = star.life / star.maxLife;
            const alpha = (1 - t) * 0.15;

            ctx.beginPath();
            ctx.moveTo(star.x, star.y);
            ctx.lineTo(star.x - 50, star.y - 25);
            ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        });
    }

    animate(timestamp = performance.now()) {
        this.maybeSpawnShootingStar(timestamp);
        this.drawFrame(timestamp);
        requestAnimationFrame((t) => this.animate(t));
    }
}

// Number Count-Up Animation for Comparison Metrics
class NumberCounter {
    constructor() {
        this.elements = document.querySelectorAll('.count-up');
        if (!this.elements.length) return;
        this.init();
    }

    init() {
        const observerOptions = {
            threshold: 0.2,
            rootMargin: '0px 0px -60px 0px'
        };

        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateElement(entry.target);
                    obs.unobserve(entry.target);
                }
            });
        }, observerOptions);

        this.elements.forEach(el => {
            const prefix = el.dataset.prefix || '';
            const suffix = el.dataset.suffix || '';
            el.textContent = `${prefix}0${suffix}`;
            observer.observe(el);
        });
    }

    animateElement(el) {
        const targetStr = el.dataset.target;
        if (!targetStr) return;

        const target = parseFloat(targetStr);
        if (isNaN(target)) return;

        const prefix = el.dataset.prefix || '';
        const suffix = el.dataset.suffix || '';
        const decimals = (targetStr.split('.')[1] || '').length;
        const duration = 1600;
        const start = 0;
        const startTime = performance.now();

        const easeOutQuad = (t) => t * (2 - t);

        const step = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easeOutQuad(progress);
            const value = start + (target - start) * eased;

            el.textContent = `${prefix}${value.toFixed(decimals)}${suffix}`;

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                el.textContent = `${prefix}${target.toFixed(decimals)}${suffix}`;
            }
        };

        requestAnimationFrame(step);
    }
}

// Initialize all components when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize particle system
    const canvas = document.getElementById('particleCanvas');
    if (canvas) {
        new ParticleSystem(canvas);
    }
    
    // Initialize parallax controller
    new ParallaxController();
    
    // Initialize scroll animations
    new ScrollAnimator();
    
    // Initialize navbar
    new NavbarController();
    
    // Initialize mobile menu
    new MobileMenu();
    
    // Initialize smooth scroll
    new SmoothScroll();
    
    // Initialize ripple effect
    new RippleEffect();
    
    // Initialize card tilt
    new CardTilt();
    
    // Initialize scroll progress
    new ScrollProgress();

    // Initialize model radar chart
    const radarCanvas = document.getElementById('modelRadarCanvas');
    if (radarCanvas) {
        const tooltipEl = document.querySelector('.radar-tooltip');
        const legendItems = Array.from(document.querySelectorAll('.radar-legend-item'));
        new ModelRadarChart(radarCanvas, tooltipEl, legendItems);
    }

    // Initialize model performance starfield background
    const performanceStarsCanvas = document.getElementById('modelPerformanceStarsBg');
    if (performanceStarsCanvas) {
        new ModelPerformanceBackground(performanceStarsCanvas);
    }

    // Initialize number counters
    new NumberCounter();
    
    // Add loading animation with cinematic fade
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 1s cubic-bezier(0.4, 0, 0.2, 1)';
        document.body.style.opacity = '1';
    }, 100);
    
    // Add smooth reveal animation to hero content
    const heroContent = document.querySelector('.hero-content');
    if (heroContent) {
        setTimeout(() => {
            heroContent.style.animation = 'fadeInUp 1.2s ease-out';
        }, 300);
    }
});

// Add ripple effect styles dynamically
const style = document.createElement('style');
style.textContent = `
    .btn {
        position: relative;
        overflow: hidden;
    }
    
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: scale(0);
        animation: ripple-animation 0.6s ease-out;
        pointer-events: none;
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
