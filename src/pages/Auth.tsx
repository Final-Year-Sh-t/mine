import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Shield, Mail, Lock, User, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signUpSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(searchParams.get('mode') === 'signup');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      if (isSignUp) {
        const result = signUpSchema.safeParse(formData);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach((err) => {
            if (err.path[0]) {
              fieldErrors[err.path[0].toString()] = err.message;
            }
          });
          setErrors(fieldErrors);
          setIsLoading(false);
          return;
        }

        const { error } = await signUp(formData.email, formData.password, formData.fullName);
        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              title: 'Account exists',
              description: 'This email is already registered. Please sign in instead.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Sign up failed',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Account created!',
            description: 'Welcome to VerifyID. You can now start verifying identities.',
          });
          navigate('/dashboard');
        }
      } else {
        const result = signInSchema.safeParse(formData);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach((err) => {
            if (err.path[0]) {
              fieldErrors[err.path[0].toString()] = err.message;
            }
          });
          setErrors(fieldErrors);
          setIsLoading(false);
          return;
        }

        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast({
              title: 'Invalid credentials',
              description: 'Please check your email and password.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Sign in failed',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Welcome back!',
            description: 'You have successfully signed in.',
          });
          navigate('/dashboard');
        }
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setErrors({});
    setFormData({ fullName: '', email: '', password: '', confirmPassword: '' });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 md:p-6 relative overflow-hidden">
      {/* Back link */}
      <Link
        to="/"
        className="fixed top-4 left-4 md:top-6 md:left-6 inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors z-50"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Back to home</span>
      </Link>

      {/* Main Auth Wrapper */}
      <div className={`auth-wrapper ${isSignUp ? 'toggled' : ''}`}>
        {/* Background Geometric Shapes */}
        <div className="background-shape" />
        <div className="secondary-shape" />

        {/* Sign In Credentials Panel */}
        <div className="credentials-panel signin">
          <h2 className="slide-element">Login</h2>
          <form onSubmit={handleSubmit}>
            <div className="field-wrapper slide-element">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
              <label>Email</label>
              <Mail className="input-icon" />
            </div>
            <div className="field-wrapper slide-element">
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
              />
              <label>Password</label>
              <Lock className="input-icon" />
            </div>
            {errors.email && <p className="error-text">{errors.email}</p>}
            {errors.password && <p className="error-text">{errors.password}</p>}
            {!isSignUp && (
              <div className="text-right mt-2 slide-element">
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
            )}
            <div className="field-wrapper slide-element">
              <button className="submit-button" type="submit" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  'Login'
                )}
              </button>
            </div>
            <div className="switch-link slide-element">
              <p>
                Don't have an account? <br />
                <a href="#" onClick={(e) => { e.preventDefault(); toggleMode(); }} className="register-trigger">
                  Sign Up
                </a>
              </p>
            </div>
          </form>
        </div>

        {/* Welcome Section for Sign In */}
        <div className="welcome-section signin">
          <Shield className="w-16 h-16 mx-auto mb-4 slide-element" style={{ color: 'hsl(var(--primary-foreground))' }} />
          <h2 className="slide-element">WELCOME!</h2>
        </div>

        {/* Sign Up Credentials Panel */}
        <div className="credentials-panel signup">
          <h2 className="slide-element">Register</h2>
          <form onSubmit={handleSubmit}>
            <div className="field-wrapper slide-element">
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                required
              />
              <label>Full Name</label>
              <User className="input-icon" />
            </div>
            <div className="field-wrapper slide-element">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
              <label>Email</label>
              <Mail className="input-icon" />
            </div>
            <div className="field-wrapper slide-element">
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
              />
              <label>Password</label>
              <Lock className="input-icon" />
            </div>
            <div className="field-wrapper slide-element">
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
              />
              <label>Confirm Password</label>
              <Lock className="input-icon" />
            </div>
            {Object.keys(errors).length > 0 && (
              <div className="error-text">
                {Object.values(errors).map((error, i) => (
                  <p key={i}>{error}</p>
                ))}
              </div>
            )}
            <div className="field-wrapper slide-element">
              <button className="submit-button" type="submit" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Creating account...
                  </span>
                ) : (
                  'Register'
                )}
              </button>
            </div>
            <div className="switch-link slide-element">
              <p>
                Already have an account? <br />
                <a href="#" onClick={(e) => { e.preventDefault(); toggleMode(); }} className="login-trigger">
                  Sign In
                </a>
              </p>
            </div>
          </form>
        </div>

        {/* Welcome Section for Sign Up */}
        <div className="welcome-section signup">
          <Shield className="w-16 h-16 mx-auto mb-4 slide-element" style={{ color: 'hsl(var(--primary-foreground))' }} />
          <h2 className="slide-element">WELCOME!</h2>
        </div>
      </div>
    </div>
  );
}
