const catchAsync = require('../utills/catchAsync');
const AppError = require('../utills/appError');
const APIFeatures = require('../utills/apiFeatures');
const employedLeave = require('../model/employeePaidLeave.model');

exports.deleteOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(204).json({
      status: 'success',
      data: null,
    });
  });

exports.updateOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  });

exports.updateProbation = (Model) =>
  catchAsync(async (req, res, next) => {
    // const currentYear = new Date().getFullYear();
    // const financialYearStart = new Date(currentYear, 3, 1); // April 1st of the current year
    // const financialYearEnd = new Date(currentYear + 1, 2, 31); // March 31st of the next year
    // // const joinDate = new Date(req.body.joinDate);
    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    // const joinDate = new Date(doc.joinDate);
    // const monthsDifference =joinDate.getMonth() - financialYearStart.getMonth();
    // let initialCasualLeaves = 0;
    // if (monthsDifference < 0) {
    //   initialCasualLeaves = -monthsDifference;
    // } else {
    //   initialCasualLeaves = 12 - monthsDifference;
    // }

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    // const updateLeave = await employedLeave.findOneAndUpdate(
    //   {employeeId:doc._id},
    //   {casualLeave:initialCasualLeaves},
    //  { new: true,
    //   runValidators: true}
    // )

    res.status(200).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  });

exports.createOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.create(req.body);

    res.status(201).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  });

exports.getOne = (Model, popOptions) =>
  catchAsync(async (req, res, next) => {
    let query = Model.findById(req.params.id);
    if (popOptions) query = query.populate(popOptions);
    const doc = await query;

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  });

exports.getAll = (Model) =>
  catchAsync(async (req, res, next) => {
    // To allow for nested GET reviews on tour (hack)
    let filter = {};
    if (req.params.userId) filter = { user: req.params.userId };

    const features = new APIFeatures(
      Model.find(
        { role: { $in: ['Employee', 'Management', 'HR', 'TeamLead'] } },
        filter
      ).populate({
        path: 'shifts',
        select: 'name startTime endTime', // Specify fields to populate
      }),
      req.query
    )
      .filter()
      .sort()
      .limitFields()
      .paginate();

    // const doc = await features.query.explain();
    const doc = await features.query;

    // SEND RESPONSE
    res.status(200).json({
      status: 'success',
      results: doc.length,
      data: {
        data: doc,
      },
    });
  });

exports.getEmployees = (Model, pop) =>
  catchAsync(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const filter = req.query.filter || '';
    const sortField = req.query.sortField || 'createdAt';
    const sortOrder = req.query.sortOrder.toLowerCase() || 'desc';

    const skip = (page - 1) * limit;

    const sortOptions = {};
    sortOptions[sortField] = sortOrder === 'desc' ? -1 : 1;

    const query = Model.find({
      role: { $in: ['Employee', 'HR', 'Management','TeamLead'] },
      name: { $regex: filter, $options: 'i' },
    })
      .populate(pop)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .exec();

    await Promise.all([
      query,
      Model.countDocuments({
        role: 'Employee',
        name: { $regex: filter, $options: 'i' },
      }),
    ])
      .then(([data, totalCount]) => {
        res.json({
          data,
          page,
          limit,
          totalCount,
        });
      })
      .catch((err) => {
        console.error('Error retrieving data:', err);
        res.status(500).json({ error: 'An error occurred' });
      });
  });

exports.getAllManagement = (Model) =>
  catchAsync(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const filter = req.query.filter || '';

    const sortField = req.query.sortField || 'createdAt';
    const sortOrder = req.query.sortOrder.toLowerCase() || 'desc';

    const skip = (page - 1) * limit;
    const sortOptions = {};
    sortOptions[sortField] = sortOrder === 'desc' ? -1 : 1;

    const query = Model.find({
      name: { $regex: filter, $options: 'i' }, // Case-insensitive filter on the name field
      role: { $nin: ['Admin', 'Employee'] }, // Exclude users with the role 'admin'
    })
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .exec();

    await Promise.all([
      query,
      Model.countDocuments({
        name: { $regex: filter, $options: 'i' }, // Case-insensitive filter on the name field
        role: { $nin: ['Admin', 'Employee'] }, // Exclude users with the role 'admin'
      }),
    ])
      .then(([data, totalCount]) => {
        res.json({
          data,
          page,
          limit,
          totalCount,
        });
      })
      .catch((err) => {
        console.error('Error retrieving data:', err);
        res.status(500).json({ error: 'An error occurred' });
      });
  });
