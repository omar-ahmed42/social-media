const { sequelize } = require('../db/connect');
const { User } = require('./user');
const { DataTypes } = require('sequelize');

const FriendRequestStatusesEnum = Object.freeze({
  pending: 'pending',
  accepted: 'accepted',
  rejected: 'rejected',
  cancelled: 'cancelled',
});

const FriendRequest = sequelize.define(
  'FriendRequest',
  {
    id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    senderId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: User, key: 'id' },
    },
    receiverId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: User, key: 'id' },
    },
    requestStatus: {
      type: DataTypes.ENUM(
        FriendRequestStatusesEnum.pending,
        FriendRequestStatusesEnum.accepted,
        FriendRequestStatusesEnum.rejected,
        FriendRequestStatusesEnum.cancelled
      ),
      allowNull: false,
    },
  },
  {
    tableName: 'friend_request',
    underscored: true,
    createdAt: true,
    updatedAt: 'lastModifiedAt',
  }
);

User.belongsToMany(User, {
  as: 'sender',
  foreignKey: 'senderId',
  through: { model: FriendRequest, unique: false },
});

User.belongsToMany(User, {
  as: 'receiver',
  foreignKey: 'receiverId',
  through: { model: FriendRequest, unique: false },
});

module.exports = {
  FriendRequest,
  FriendRequestStatusesEnum,
};
