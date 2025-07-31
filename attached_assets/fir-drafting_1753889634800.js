document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const nextStep1Btn = document.getElementById('nextStep1');
    const nextStep2Btn = document.getElementById('nextStep2');
    const nextStep3Btn = document.getElementById('nextStep3');
    const prevStep2Btn = document.getElementById('prevStep2');
    const prevStep3Btn = document.getElementById('prevStep3');
    const prevStep4Btn = document.getElementById('prevStep4');
    const submitFIRBtn = document.getElementById('submitFIR');
    const resetFormBtn = document.getElementById('resetForm');
    
    // IPC Sections database
    const ipcSections = {
        'theft': [
            { code: 'IPC 378', title: 'Theft', description: 'Whoever, intending to take dishonestly any movable property out of the possession of any person without that person\'s consent, moves that property in order to such taking, is said to commit theft.' },
            { code: 'IPC 379', title: 'Punishment for theft', description: 'Whoever commits theft shall be punished with imprisonment of either description for a term which may extend to three years, or with fine, or with both.' }
        ],
        'assault': [
            { code: 'IPC 351', title: 'Assault', description: 'Whoever makes any gesture, or any preparation intending or knowing it to be likely that such gesture or preparation will cause any person present to apprehend that he who makes that gesture or preparation is about to use criminal force to that person, is said to commit an assault.' },
            { code: 'IPC 352', title: 'Punishment for assault', description: 'Whoever assaults or uses criminal force to any person otherwise than on grave and sudden provocation given by that person, shall be punished with imprisonment of either description for a term which may extend to three months, or with fine which may extend to five hundred rupees, or with both.' }
        ],
        'fraud': [
            { code: 'IPC 415', title: 'Cheating', description: 'Whoever, by deceiving any person, fraudulently or dishonestly induces the person so deceived to deliver any property to any person, or to consent that any person shall retain any property, or intentionally induces the person so deceived to do or omit to do anything which he would not do or omit if he were not so deceived, and which act or omission causes or is likely to cause damage or harm to that person in body, mind, reputation or property, is said to "cheat".' },
            { code: 'IPC 420', title: 'Cheating and dishonestly inducing delivery of property', description: 'Whoever cheats and thereby dishonestly induces the person deceived to deliver any property to any person, or to make, alter or destroy the whole or any part of a valuable security, or anything which is signed or sealed, and which is capable of being converted into a valuable security, shall be punished with imprisonment of either description for a term which may extend to seven years, and shall also be liable to fine.' }
        ],
        'cybercrime': [
            { code: 'IPC 66C', title: 'Identity theft', description: 'Whoever, fraudulently or dishonestly make use of the electronic signature, password or any other unique identification feature of any other person, shall be punished with imprisonment of either description for a term which may extend to three years and shall also be liable to fine which may extend to rupees one lakh.' },
            { code: 'IPC 66D', title: 'Cheating by personation by using computer resource', description: 'Whoever, by means of any communication device or computer resource cheats by personating, shall be punished with imprisonment of either description for a term which may extend to three years and shall also be liable to fine which may extend to one lakh rupees.' }
        ],
        'other': [
            { code: 'IPC 34', title: 'Acts done by several persons in furtherance of common intention', description: 'When a criminal act is done by several persons in furtherance of the common intention of all, each of such persons is liable for that act in the same manner as if it were done by him alone.' },
            { code: 'IPC 120B', title: 'Punishment of criminal conspiracy', description: 'Whoever is a party to a criminal conspiracy to commit an offence punishable with death, imprisonment for life or rigorous imprisonment for a term of two years or upwards, shall, where no express provision is made in this Code for the punishment of such a conspiracy, be punished in the same manner as if he had abetted such offence.' }
        ]
    };
    
    // Form navigation
    let currentStep = 1;
    
    function goToStep(step) {
        // Hide current step
        document.getElementById(`formStep${currentStep}`).classList.remove('active');
        document.getElementById(`step${currentStep}`).classList.remove('active');
        
        // Show new step
        document.getElementById(`formStep${step}`).classList.add('active');
        document.getElementById(`step${step}`).classList.add('active');
        
        // Mark previous steps as completed
        for (let i = 1; i < step; i++) {
            document.getElementById(`step${i}`).classList.add('completed');
        }
        
        // Unmark future steps as completed
        for (let i = step + 1; i <= 4; i++) {
            document.getElementById(`step${i}`).classList.remove('completed');
        }
        
        currentStep = step;
    }
    
    function validateStep1() {
        const incidentType = document.getElementById('incidentType').value;
        const location = document.getElementById('location').value;
        const incidentDate = document.getElementById('incidentDate').value;
        const incidentDescription = document.getElementById('incidentDescription').value;
        
        if (!incidentType || !location || !incidentDate || !incidentDescription) {
            alert('Please fill all required fields in Incident Details');
            return false;
        }
        return true;
    }
    
    function validateStep2() {
        const victimName = document.getElementById('victimName').value;
        const victimContact = document.getElementById('victimContact').value;
        
        if (!victimName || !victimContact) {
            alert('Please fill all required fields in Victim Information');
            return false;
        }
        return true;
    }
    
    function suggestSections() {
        const incidentType = document.getElementById('incidentType').value;
        const sectionsContainer = document.getElementById('sectionsContainer');
        
        sectionsContainer.innerHTML = '';
        
        if (ipcSections[incidentType]) {
            ipcSections[incidentType].forEach(section => {
                const sectionCard = document.createElement('div');
                sectionCard.className = 'section-card';
                sectionCard.innerHTML = `
                    <h4>${section.code}</h4>
                    <p>${section.title}</p>
                    <p class="section-desc">${section.description}</p>
                `;
                sectionsContainer.appendChild(sectionCard);
            });
        } else {
            sectionsContainer.innerHTML = '<p>No specific sections found for this incident type. Please consult legal resources.</p>';
        }
    }
    
    function populateReviewData() {
        document.getElementById('reviewIncidentType').textContent = document.getElementById('incidentType').value;
        document.getElementById('reviewIncidentDate').textContent = document.getElementById('incidentDate').value;
        document.getElementById('reviewIncidentTime').textContent = document.getElementById('incidentTime').value;
        document.getElementById('reviewLocation').textContent = document.getElementById('location').value;
        document.getElementById('reviewIncidentDescription').textContent = document.getElementById('incidentDescription').value;
        
        document.getElementById('reviewVictimName').textContent = document.getElementById('victimName').value;
        document.getElementById('reviewVictimContact').textContent = document.getElementById('victimContact').value;
        document.getElementById('reviewVictimAddress').textContent = document.getElementById('victimAddress').value;
        
        const sectionsContainer = document.getElementById('sectionsContainer');
        const reviewSections = document.getElementById('reviewSections');
        reviewSections.innerHTML = '';
        
        sectionsContainer.querySelectorAll('.section-card').forEach(card => {
            const sectionTitle = card.querySelector('h4').textContent;
            const p = document.createElement('p');
            p.textContent = sectionTitle;
            reviewSections.appendChild(p);
        });
    }
    
    function submitFIR() {
        // In a real application, this would send data to the server
        alert('FIR submitted successfully!');
        goToStep(5);
    }
    
    function resetForm() {
        // Reset form fields
        document.getElementById('incidentType').value = '';
        document.getElementById('location').value = '';
        document.getElementById('incidentDate').value = '';
        document.getElementById('incidentTime').value = '';
        document.getElementById('incidentDescription').value = '';
        document.getElementById('victimName').value = '';
        document.getElementById('victimContact').value = '';
        document.getElementById('victimAddress').value = '';
        document.getElementById('additionalComments').value = '';
        
        // Reset stepper
        goToStep(1);
    }
    
    // Event listeners
    nextStep1Btn.addEventListener('click', function() {
        if (validateStep1()) {
            suggestSections();
            goToStep(2);
        }
    });
    
    nextStep2Btn.addEventListener('click', function() {
        if (validateStep2()) {
            goToStep(3);
        }
    });
    
    nextStep3Btn.addEventListener('click', function() {
        populateReviewData();
        goToStep(4);
    });
    
    prevStep2Btn.addEventListener('click', function() {
        goToStep(1);
    });
    
    prevStep3Btn.addEventListener('click', function() {
        goToStep(2);
    });
    
    prevStep4Btn.addEventListener('click', function() {
        goToStep(3);
    });
    
    submitFIRBtn.addEventListener('click', submitFIR);
    resetFormBtn.addEventListener('click', resetForm);
});