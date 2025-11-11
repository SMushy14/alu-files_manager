import { ObjectId } from 'mongodb';
import DBClient from '../utils/db';
import RedisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    const token = req.header('X-Token') || null;
    if (!token) return res.status(401).send({ error: 'Unauthorized' });

    const redisToken = await RedisClient.get(`auth_${token}`);
    if (!redisToken) return res.status(401).send({ error: 'Unauthorized' });

    const user = await DBClient.db.collection('users').findOne({ _id: ObjectId(redisToken) });
    if (!user) return res.status(401).send({ error: 'Unauthorized' });

    const { name, type, data, isPublic = false, parentId = 0 } = req.body;

    if (!name) return res.status(400).send({ error: 'Missing name' });
    if (!type) return res.status(400).send({ error: 'Missing type' });
    if (['folder', 'file', 'image'].includes(type) === false)
      return res.status(400).send({ error: 'Invalid type' });

    const fileData = {
      userId: user._id,
      name,
      type,
      isPublic,
      parentId: parentId === 0 ? 0 : ObjectId(parentId),
      createdAt: new Date(),
    };

    if (type !== 'folder') {
      if (!data) return res.status(400).send({ error: 'Missing data' });
      fileData.data = data; // In production, you'd store on disk or S3
    }

    const result = await DBClient.db.collection('files').insertOne(fileData);

    return res.status(201).send({
      id: result.insertedId,
      userId: user._id,
      name,
      type,
      isPublic,
      parentId,
    });
  }

  static async getShow(req, res) {
    const token = req.header('X-Token') || null;
    if (!token) return res.status(401).send({ error: 'Unauthorized' });

    const redisToken = await RedisClient.get(`auth_${token}`);
    if (!redisToken) return res.status(401).send({ error: 'Unauthorized' });

    const user = await DBClient.db.collection('users').findOne({ _id: ObjectId(redisToken) });
    if (!user) return res.status(401).send({ error: 'Unauthorized' });

    const fileId = req.params.id;
    let file;

    try {
      file = await DBClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: user._id });
    } catch (err) {
      return res.status(400).send({ error: 'Invalid file ID' });
    }

    if (!file) return res.status(404).send({ error: 'Not found' });

    const fileItem = {
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    };

    return res.send(fileItem);
  }

  static async getIndex(req, res) {
    const token = req.header('X-Token') || null;
    if (!token) return res.status(401).send({ error: 'Unauthorized' });

    const redisToken = await RedisClient.get(`auth_${token}`);
    if (!redisToken) return res.status(401).send({ error: 'Unauthorized' });

    const user = await DBClient.db.collection('users').findOne({ _id: ObjectId(redisToken) });
    if (!user) return res.status(401).send({ error: 'Unauthorized' });

    let { parentId = 0, page = 0 } = req.query;
    page = parseInt(page, 10) || 0;

    let matchCondition = { userId: user._id };
    if (parentId !== 0 && parentId !== '0') {
      try {
        matchCondition.parentId = ObjectId(parentId);
      } catch (err) {
        return res.status(400).send({ error: 'Invalid parentId' });
      }
    } else {
      matchCondition.parentId = 0;
    }

    const filesCursor = DBClient.db.collection('files').aggregate([
      { $match: matchCondition },
      { $skip: page * 20 },
      { $limit: 20 },
    ]);

    const filesArray = [];
    await filesCursor.forEach((item) => {
      filesArray.push({
        id: item._id,
        userId: item.userId,
        name: item.name,
        type: item.type,
        isPublic: item.isPublic,
        parentId: item.parentId,
      });
    });

    return res.send(filesArray);
  }
}

export default FilesController;
