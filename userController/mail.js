const catchAsync = require('../utills/catchAsync');
const Email = require('../utills/email'); 

exports.contactDetails = catchAsync(async (req, res, next) => {
    try {

        let { name, email, phone, address, message, service, budget, } = req.body;

        await new Email('', '', '').sendContactDetails(name, email, phone, address, message, service, budget);
        await new Email('','','').sendThankYou(name, email);

        res.status(200).json({
            status: 'success',
            message: 'Contact details sent successfully!',
        });
    } catch (error) {
        console.error('Error sending contact details:', error);

        res.status(500).json({
            status: 'error',
            message: 'There was an error sending the contact details. Please try again later.',
            error: error.message
        });
    }
});

exports.serviceDetails = catchAsync(async (req, res, next) => {
    try {

        let { name, email, phone, message} = req.body;

        await new Email('', '', '').sendServiceDetails(name, email, phone, message);
        await new Email('','','').sendThankYou(name, email);
        res.status(200).json({
            status: 'success',
            message: 'Contact details sent successfully!',
        });
    } catch (error) {
        console.error('Error sending contact details:', error);

        res.status(500).json({
            status: 'error',
            message: 'There was an error sending the contact details. Please try again later.',
            error: error.message
        });
    }
});


