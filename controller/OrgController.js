const catchAsync = require('../utills/catchAsync');
const AppError = require('../utills/appError');
const Organization = require('../model/organization.model');

exports.createOrganization = catchAsync(async (req, res, next) => {
  const { OrganizationName, OrganizationLogo } = req.body;

  // Validate input
  if (!OrganizationName || !OrganizationLogo) {
    return next(
      new AppError('Please provide both OrganizationName and OrganizationLogo', 400)
    );
  }

  // Create organization
  const organization = await Organization.create({
    name: OrganizationName,
    logo: OrganizationLogo,
  });

  // Respond
  res.status(201).json({
    status: 'success',
    data: organization,
  });
});
