<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Message extends Model
{
    protected $fillable = [
        'project_id',
        'sender',
        'content',
        'quick_replies',
        'related_prd_version_id',
    ];

    protected $casts = [
        'quick_replies' => 'array',
    ];

    public function project(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function relatedPrdVersion(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(PrdVersion::class, 'related_prd_version_id');
    }
}
