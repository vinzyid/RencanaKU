<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AmbiguityFlag extends Model
{
    protected $fillable = ['prd_version_id', 'code', 'question', 'is_resolved', 'resolution_answer'];

    public function prdVersion(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(PrdVersion::class);
    }
}