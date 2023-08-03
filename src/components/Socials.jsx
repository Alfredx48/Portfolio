import GitHub from "/src/assets/github.png"
import LinkedIn from "/src/assets/linkedin.png"
import Resume from "/src/assets/resume.png"
import ResumePdf from "/src/assets/Resume.pdf"
function Socials() {
  return (
    <div id="footer">
      <a rel="noopener noreferrer nofollow"
        target="_blank" href={ResumePdf}><img id="social-img" src={Resume} alt="" /> </a>
      <a rel="noopener noreferrer nofollow"
        target="_blank" href="https://github.com/Alfredx48"><img id="social-img" src={GitHub} alt="" /> </a>
      <a rel="noopener noreferrer nofollow"
        target="_blank" href="https://www.linkedin.com/in/alfredx48/"><img id="social-img" src={LinkedIn} alt="" /> </a>
    </div>
  )
}

export default Socials