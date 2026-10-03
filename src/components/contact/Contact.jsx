import emailjs from '@emailjs/browser';
import { A } from '@solidjs/router';
import { createSignal, onMount } from 'solid-js';
import { toast } from '../../utils/toast';
import './contact.css';

// EmailJS IDs and public key are meant to live in client code.
const SERVICE_ID = 'service_vysbmr8';
const TEMPLATE_ID = 'template_v2qnv8p';
const PUBLIC_KEY = 'cWZHoBRw_PR2wBlwi';

function Contact() {
	let form;
	const [sending, setSending] = createSignal(false);

	onMount(() => (document.title = 'Contact | Alfred Shaheen'));

	const sendEmail = async (e) => {
		e.preventDefault();
		setSending(true);
		try {
			await emailjs.sendForm(SERVICE_ID, TEMPLATE_ID, form, { publicKey: PUBLIC_KEY });
			form.reset();
			toast("Thanks! Your message is on its way. I'll get back to you soon.");
		} catch {
			toast('Sorry, the message failed to send. Please try again or reach me on LinkedIn.', 'error');
		} finally {
			setSending(false);
		}
	};

	return (
		<section class="page contact">
			<div class="contact-panel">
				<A href="/" class="back-link">
					<span aria-hidden="true">←</span> Home
				</A>
				<h1 class="page-title">Get in touch</h1>
				<p class="contact-lede">Have a role, a project or a question? Send me a message.</p>

				<form class="contact-form" ref={form} onSubmit={sendEmail}>
					<label for="contact-name">Name</label>
					<input id="contact-name" name="user_name" type="text" autocomplete="name" required />

					<label for="contact-email">Email</label>
					<input id="contact-email" name="user_email" type="email" autocomplete="email" required />

					<label for="contact-message">Message</label>
					<textarea id="contact-message" name="message" rows="6" required />

					<button class="btn" type="submit" disabled={sending()}>
						{sending() ? 'Sending…' : 'Send message'}
					</button>
				</form>
			</div>
		</section>
	);
}

export default Contact;
